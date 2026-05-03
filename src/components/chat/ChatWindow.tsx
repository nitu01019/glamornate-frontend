'use client';

import { useEffect, useMemo, useRef, useState, useCallback, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { X, Send, LogIn, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useChatStore, QUICK_REPLIES } from '@/store/chat';
import { useAuth } from '@/lib/auth-provider';
import type { ChatMessage as ChatMessageType } from '@/types';
import ChatMessage from './ChatMessage';
import QuickReplies from './QuickReplies';

// F6: WELCOME_MESSAGE.timestamp was module-scoped, which froze `new Date()` to
// the bundle load time and emitted before hydration. It is now built per-mount
// inside the component via `useMemo` (see below) so every session starts with
// a fresh client-side timestamp and no SSR/CSR divergence.
const WELCOME_MESSAGE_TEMPLATE: Omit<ChatMessageType, 'timestamp'> = {
  id: 'welcome',
  chatId: 'default',
  sender: 'bot',
  text: 'Hi! Welcome to Glamornate. How can we help you today?',
  read: true,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MessageSkeleton() {
  return (
    <div className="space-y-3 p-4" aria-label="Loading messages">
      {/* Bot message skeleton */}
      <div className="flex justify-start">
        <div className="max-w-[80%]">
          <div className="h-10 w-48 animate-pulse rounded-2xl bg-gray-100" />
          <div className="mt-1 h-3 w-16 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
      {/* User message skeleton */}
      <div className="flex justify-end">
        <div className="max-w-[80%]">
          <div className="h-10 w-40 animate-pulse rounded-2xl bg-indigo-100" />
          <div className="mt-1 ml-auto h-3 w-16 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
      {/* Bot message skeleton */}
      <div className="flex justify-start">
        <div className="max-w-[80%]">
          <div className="h-16 w-56 animate-pulse rounded-2xl bg-gray-100" />
          <div className="mt-1 h-3 w-16 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
    </div>
  );
}

function ConnectionIndicator({ status }: { status: string }) {
  if (status === 'connected') {
    return (
      <span className="flex items-center gap-1 text-xs text-green-200" title="Connected">
        <Wifi className="h-3 w-3" />
        <span className="sr-only">Connected</span>
      </span>
    );
  }
  if (status === 'connecting') {
    return (
      <span className="flex items-center gap-1 text-xs text-yellow-200" title="Connecting">
        <Wifi className="h-3 w-3 animate-pulse" />
        <span className="sr-only">Connecting</span>
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1 text-xs text-red-200" title="Disconnected">
        <WifiOff className="h-3 w-3" />
        <span className="sr-only">Disconnected</span>
      </span>
    );
  }
  // disconnected — no indicator in demo mode
  return null;
}

function LoginPrompt({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50">
        <LogIn className="h-8 w-8 text-indigo-600" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-gray-900">Sign in to chat</h3>
        <p className="mt-1 text-sm text-gray-500">
          Please log in to start a conversation with our support team.
        </p>
      </div>
      <button
        type="button"
        onClick={onLogin}
        className="rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        Log in
      </button>
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="flex shrink-0 items-center gap-1 rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
      >
        <RefreshCw className="h-3 w-3" />
        Retry
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ChatWindow() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');

  // Store selectors
  const isOpen = useChatStore((s) => s.isOpen);
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const connectionStatus = useChatStore((s) => s.connectionStatus);
  const error = useChatStore((s) => s.error);
  const closeChat = useChatStore((s) => s.closeChat);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const addMessage = useChatStore((s) => s.addMessage);
  const initializeFirebase = useChatStore((s) => s.initializeFirebase);
  const subscribe = useChatStore((s) => s.subscribe);
  const disconnect = useChatStore((s) => s.disconnect);
  const markAllRead = useChatStore((s) => s.markAllRead);
  const retry = useChatStore((s) => s.retry);

  const auth = useAuth();
  const user = auth?.user ?? null;
  const firebaseUser = auth?.firebaseUser ?? null;
  const isAuthLoading = auth?.isLoading ?? false;

  const isLoggedIn = !!user && !!firebaseUser;

  // -------------------------------------------------------------------------
  // Firebase chat lifecycle: initialize when the window opens with an
  // authenticated user; disconnect on close (or on logout while open).
  // Merging init + disconnect into a single effect keeps the lifecycle symmetric
  // and piggybacks on the cleanup phase rather than using a separate effect.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen || !isLoggedIn || !firebaseUser || !user) return;

    initializeFirebase(firebaseUser.uid, user.profile.displayName);
    return () => {
      disconnect();
    };
  }, [isOpen, isLoggedIn, firebaseUser, user, initializeFirebase, disconnect]);

  // -------------------------------------------------------------------------
  // Subscribe to real-time messages once the socket is connected, and mark any
  // in-flight messages as read. Both side effects share the same
  // `(isOpen, connectionStatus === 'connected')` gate — merging them avoids a
  // redundant effect pass while keeping the original intent clear.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen || connectionStatus !== 'connected') return;

    const unsubscribe = subscribe();
    markAllRead();

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `messages` intentionally omitted: mark-read is driven by open/connect transitions, not message churn; adding it would loop (markAllRead mutates state → new render → effect fires again)
  }, [isOpen, connectionStatus, subscribe, markAllRead]);

  // -------------------------------------------------------------------------
  // Intercept Android hardware back-button while chat is open so the user
  // returns to the previous page state instead of navigating away.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: Event): void => {
      event.preventDefault();
      closeChat();
    };
    window.addEventListener('glamornate:back-button', handler);
    return () => window.removeEventListener('glamornate:back-button', handler);
  }, [isOpen, closeChat]);

  // -------------------------------------------------------------------------
  // Auto-scroll to latest message
  // -------------------------------------------------------------------------
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // F6: Build the welcome message fresh per component mount inside `useMemo`
  // so the timestamp reflects the client clock rather than the module-load
  // time (which would drift between SSR prerender and client hydration).
  const welcomeMessage = useMemo<ChatMessageType>(
    () => ({ ...WELCOME_MESSAGE_TEMPLATE, timestamp: new Date().toISOString() }),
    [],
  );

  // -------------------------------------------------------------------------
  // Show welcome message on first open when there are no messages (demo mode)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (isOpen && messages.length === 0 && connectionStatus !== 'connecting') {
      addMessage(welcomeMessage);
    }
  }, [isOpen, messages.length, connectionStatus, addMessage, welcomeMessage]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setInputValue('');
      await sendMessage(trimmed);
    },
    [sendMessage],
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend(inputValue);
  };

  const handleQuickReply = useCallback(
    (reply: (typeof QUICK_REPLIES)[number]) => {
      if (reply.action === 'navigate' && 'path' in reply) {
        closeChat();
        router.push(reply.path);
      } else if (reply.action === 'message' && 'text' in reply) {
        handleSend(reply.text);
      }
    },
    [closeChat, router, handleSend],
  );

  const handleLoginClick = useCallback(() => {
    closeChat();
    router.push('/auth/login');
  }, [closeChat, router]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (!isOpen) return null;

  const showLoginPrompt = !isAuthLoading && !isLoggedIn;
  const showSkeleton = isLoading && messages.length === 0 && connectionStatus === 'connecting';

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-[59] bg-black/30 sm:hidden"
        onClick={closeChat}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-label="Chat with Glamornate Support"
        className="fixed inset-0 z-[60] flex flex-col bg-white sm:inset-auto sm:bottom-24 sm:left-6 sm:h-[500px] sm:w-[380px] sm:rounded-2xl sm:shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-indigo-600 px-4 py-3 text-white sm:rounded-t-2xl">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Glamornate Support</h2>
            <ConnectionIndicator status={connectionStatus} />
          </div>
          <button
            type="button"
            onClick={closeChat}
            aria-label="Close chat"
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error banner */}
        {error && <ErrorBanner message={error} onRetry={retry} />}

        {/* Content area */}
        {showLoginPrompt ? (
          <LoginPrompt onLogin={handleLoginClick} />
        ) : showSkeleton ? (
          <MessageSkeleton />
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}

              {/* Typing indicator when waiting for response */}
              {isLoading && messages.length > 0 && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-2xl bg-gray-100 px-4 py-3">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick replies */}
            <QuickReplies onSelect={handleQuickReply} />

            {/* Input area */}
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 border-t border-gray-100 px-4 py-3"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <button
                type="submit"
                disabled={!inputValue.trim()}
                aria-label="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </>
        )}
      </div>
    </>
  );
}
