import { firebaseConfig } from './config';

export enum ErrorCategory {
  AUTH = 'auth',
  FIRESTORE = 'firestore',
  STORAGE = 'storage',
  FUNCTIONS = 'functions',
  NETWORK = 'network',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown',
}

export interface LogEntry {
  timestamp: string;
  category: ErrorCategory;
  caller: string;
  function: string;
  operation: string;
  error: {
    code?: string;
    message: string;
    stack?: string;
  };
  context?: Record<string, unknown>;
  isConfigured: boolean;
  isMockFallback: boolean;
}

export class ErrorLogger {
  private static instance: ErrorLogger;
  private logs: LogEntry[] = [];
  private maxLogs = 100;

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  private formatMessage(entry: LogEntry): string {
    const basename = entry.caller.split('/').pop() || entry.caller;
    const tags = [
      entry.isMockFallback ? '[MOCK_FALLBACK]' : '',
      !entry.isConfigured ? '[NOT_CONFIGURED]' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      `[Firebase][${entry.category}][${basename}] ${entry.function}${tags ? ` ${tags}` : ''}\n` +
      `    Operation: ${entry.operation}\n` +
      `    Error: ${entry.error.code ? entry.error.code + ': ' : ''}${entry.error.message}`
    );
  }

  private sanitizeContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!context) return undefined;

    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'credential'];
    const sanitized = { ...context };

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  log(params: {
    category: ErrorCategory;
    caller: string;
    function: string;
    operation: string;
    error: Error | { code?: string; message: string; stack?: string };
    context?: Record<string, unknown>;
  }): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      category: params.category,
      caller: params.caller,
      function: params.function,
      operation: params.operation,
      error: {
        code: (params.error as { code?: string }).code,
        message: (params.error as { message?: string }).message || String(params.error),
        stack: (params.error as { stack?: string }).stack,
      },
      context: this.sanitizeContext(params.context),
      isConfigured: firebaseConfig.isConfigured(),
      isMockFallback: firebaseConfig.shouldUseMock(),
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    if (firebaseConfig.isDebugEnabled()) {
      console.warn(this.formatMessage(entry));
      if (entry.context) {
        console.log('    Context:', entry.context);
      }
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const errorLogger = ErrorLogger.getInstance();
