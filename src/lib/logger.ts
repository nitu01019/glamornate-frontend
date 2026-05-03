/**
 * Client-side Structured Logger
 * Provides consistent logging across the Glamornate application
 */

// =============================================================================
// Types
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  /** Component or module name */
  component?: string;
  /** Action being performed */
  action?: string;
  /** User ID (if authenticated) */
  userId?: string;
  /** Request/operation ID for tracing */
  traceId?: string;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

export interface LoggerConfig {
  /** Minimum log level to output */
  minLevel: LogLevel;
  /** Whether to include timestamps */
  includeTimestamp: boolean;
  /** Whether to enable console output */
  enableConsole: boolean;
  /** Whether to batch and send errors to server */
  enableRemote: boolean;
  /** Remote endpoint for error reporting */
  remoteEndpoint?: string;
  /** Batch size before sending to server */
  batchSize: number;
  /** Flush interval in ms */
  flushInterval: number;
}

// =============================================================================
// Constants
// =============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LOG_COLORS: Record<LogLevel, string> = {
  debug: '#6B7280', // gray-500
  info: '#3B82F6', // blue-500
  warn: '#F59E0B', // amber-500
  error: '#EF4444', // red-500
};

const LOG_ICONS: Record<LogLevel, string> = {
  debug: '🔍',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
};

// =============================================================================
// PII Redaction
// =============================================================================

/** Fields whose values should be redacted before logging. */
const PII_KEYS = new Set([
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'authorization',
  'cookie',
  'creditcard',
  'cardnumber',
  'cvv',
  'ssn',
  'phone',
  'email',
  'privatekey',
]);

/**
 * Recursively redact PII from metadata objects.
 * Returns a new object -- the original is never mutated.
 */
function redactPII(obj: unknown, depth = 0): unknown {
  if (depth > 8 || obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redactPII(item, depth + 1));
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (PII_KEYS.has(key.toLowerCase().replace(/[_-]/g, ''))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactPII(value, depth + 1);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

// =============================================================================
// Logger Class
// =============================================================================

class Logger {
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: Partial<LoggerConfig> = {}) {
    const isDev =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    this.config = {
      minLevel: isDev ? 'debug' : 'warn',
      includeTimestamp: true,
      enableConsole: true,
      enableRemote: !isDev,
      batchSize: 10,
      flushInterval: 30000, // 30 seconds
      ...config,
    };

    // Start flush timer if remote logging is enabled
    if (this.config.enableRemote && typeof window !== 'undefined') {
      this.startFlushTimer();

      // Flush on page unload — use `pagehide` and `visibilitychange` rather
      // than the older `beforeunload` (which fires inconsistently on mobile
      // and during Next.js client-side route changes). Both events are the
      // canonical telemetry-flush signals per the Page Lifecycle API.
      const flushSync = (): void => {
        this.flushBeacon();
      };
      window.addEventListener('pagehide', flushSync);
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushSync();
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Public Methods
  // ---------------------------------------------------------------------------

  debug(message: string, context?: LogContext, metadata?: Record<string, unknown>): void {
    this.log('debug', message, context, metadata);
  }

  info(message: string, context?: LogContext, metadata?: Record<string, unknown>): void {
    this.log('info', message, context, metadata);
  }

  warn(message: string, context?: LogContext, metadata?: Record<string, unknown>): void {
    this.log('warn', message, context, metadata);
  }

  error(
    message: string,
    error?: Error | unknown,
    context?: LogContext,
    metadata?: Record<string, unknown>,
  ): void {
    const errorDetails = this.extractErrorDetails(error);
    this.log('error', message, context, { ...metadata, error: errorDetails });
  }

  /**
   * Create a child logger with preset context
   */
  child(context: LogContext): ChildLogger {
    return new ChildLogger(this, context);
  }

  /**
   * Force flush buffered logs to server.
   *
   * Used during steady-state in-page batches. Uses `fetch` with `keepalive`
   * so the request can survive a brief navigation; for the actual
   * `pagehide` / `visibilitychange→hidden` path use {@link flushBeacon}
   * which is synchronous and the only API guaranteed by browsers to
   * complete after the document is unloaded.
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    if (!this.config.enableRemote || !this.config.remoteEndpoint) {
      return;
    }

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entries),
        keepalive: true,
      });
    } catch (err) {
      // Silently fail - we don't want logging to break the app
      if (this.config.enableConsole && process.env.NODE_ENV !== 'production') {
        console.warn('[Logger] Failed to send logs to server:', err);
      }
    }
  }

  /**
   * Synchronous flush via the Beacon API for use during page lifecycle
   * transitions (`pagehide`, `visibilitychange→hidden`). `sendBeacon` is the
   * only spec-compliant way to ship telemetry that MUST survive document
   * unload — it queues the request with the browser's network task and
   * does not block page transition. Falls back to keepalive `fetch` when
   * Beacon is unavailable (rare; older WebViews).
   */
  private flushBeacon(): void {
    if (this.buffer.length === 0) return;
    if (!this.config.enableRemote || !this.config.remoteEndpoint) return;

    const entries = [...this.buffer];
    this.buffer = [];

    const endpoint = this.config.remoteEndpoint;
    const body = JSON.stringify(entries);

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        const blob = new Blob([body], { type: 'application/json' });
        const ok = navigator.sendBeacon(endpoint, blob);
        if (ok) return;
      } catch {
        // fall through to fetch
      }
    }

    // Fallback: keepalive fetch — best-effort during unload.
    try {
      void fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      });
    } catch {
      // Swallow — by definition we are unloading.
    }
  }

  /**
   * Update logger configuration
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    metadata?: Record<string, unknown>,
  ): void {
    // Check minimum level
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      metadata: metadata ? (redactPII(metadata) as Record<string, unknown>) : undefined,
    };

    // Console output
    if (this.config.enableConsole) {
      this.printToConsole(entry);
    }

    // Buffer error/warn logs for remote reporting
    if (this.config.enableRemote && (level === 'error' || level === 'warn')) {
      this.buffer.push(entry);

      if (this.buffer.length >= this.config.batchSize) {
        this.flush();
      }
    }
  }

  private printToConsole(entry: LogEntry): void {
    const { level, message, context, metadata, timestamp } = entry;
    // In production, only allow warn/error to reach the console. Gate
    // info/debug behind the dev environment so shipped bundles don't
    // leak implementation detail or noise the browser console.
    if (
      process.env.NODE_ENV === 'production' &&
      level !== 'warn' &&
      level !== 'error'
    ) {
      return;
    }
    const color = LOG_COLORS[level];
    const icon = LOG_ICONS[level];

    // Build log parts
    const parts: unknown[] = [];
    const styles: string[] = [];

    // Timestamp
    if (this.config.includeTimestamp) {
      const date = new Date(timestamp);
      const time =
        date.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) +
        '.' +
        String(date.getMilliseconds()).padStart(3, '0');
      parts.push(`%c${time}`);
      styles.push('color: #9CA3AF; font-size: 10px;');
    }

    // Level badge
    parts.push(`%c ${icon} ${level.toUpperCase()} `);
    styles.push(
      `background: ${color}; color: white; padding: 1px 4px; border-radius: 3px; font-weight: bold; font-size: 10px;`,
    );

    // Context (component/action)
    if (context?.component || context?.action) {
      const contextStr = [context.component, context.action].filter(Boolean).join(':');
      parts.push(`%c[${contextStr}]`);
      styles.push('color: #6366F1; font-weight: 500;');
    }

    // Message
    parts.push(`%c${message}`);
    styles.push('color: inherit;');

    // Format string
    const formatStr = parts.join(' ');

    // Choose console method
    const consoleFn =
      level === 'error'
        ? console.error
        : level === 'warn'
          ? console.warn
          : level === 'debug'
            ? console.debug
            : console.log;

    // Output
    consoleFn(formatStr, ...styles);

    // Print metadata/error as group if present
    if (metadata && Object.keys(metadata).length > 0) {
      console.groupCollapsed('%c  └─ Details', 'color: #9CA3AF; font-size: 11px;');

      if (metadata.error) {
        const err = metadata.error as LogEntry['error'];
        console.log('%cError:', 'color: #EF4444; font-weight: bold;', err?.name, '-', err?.message);
        if (err?.stack) {
          console.log('%cStack:', 'color: #9CA3AF;', err.stack);
        }
        // Log remaining metadata
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructure-and-discard: `_error` is stripped from spread so it isn't double-logged (already rendered above). Whole file slated for removal when ARCH-M12 swaps to pino.
        const { error: _error, ...rest } = metadata;
        if (Object.keys(rest).length > 0) {
          console.log('%cMetadata:', 'color: #6366F1;', rest);
        }
      } else {
        console.log(metadata);
      }

      console.groupEnd();
    }
  }

  private extractErrorDetails(error: unknown): LogEntry['error'] | undefined {
    if (!error) return undefined;

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: 'code' in error ? String((error as { code: unknown }).code) : undefined,
      };
    }

    if (typeof error === 'object' && error !== null) {
      const obj = error as Record<string, unknown>;
      return {
        name: String(obj.name ?? 'Error'),
        message: String(obj.message ?? 'Unknown error'),
        code: obj.code ? String(obj.code) : undefined,
      };
    }

    return {
      name: 'Error',
      message: String(error),
    };
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }
}

// =============================================================================
// Child Logger (with preset context)
// =============================================================================

class ChildLogger {
  constructor(
    private parent: Logger,
    private context: LogContext,
  ) {}

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.parent.debug(message, this.context, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.parent.info(message, this.context, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.parent.warn(message, this.context, metadata);
  }

  error(message: string, error?: Error | unknown, metadata?: Record<string, unknown>): void {
    this.parent.error(message, error, this.context, metadata);
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

/** Global logger instance — wired to /api/v1/logs for persistent error collection */
export const logger = new Logger({
  enableRemote: true,
  remoteEndpoint: process.env.NEXT_PUBLIC_API_BASE_URL
    ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/logs`
    : '/api/v1/logs',
  batchSize: 5,
  flushInterval: 15000, // flush every 15s
});

/** Create a new logger instance with custom config */
export function createLogger(config?: Partial<LoggerConfig>): Logger {
  return new Logger(config);
}

// Re-export types
export type { Logger, ChildLogger };
