'use client';

import { MessageCircle } from 'lucide-react';
import { useChatStore } from '@/store/chat';

export default function ChatBubble() {
  const toggleChat = useChatStore((s) => s.toggleChat);
  const unreadCount = useChatStore((s) => s.unreadCount);

  return (
    <button
      type="button"
      onClick={toggleChat}
      aria-label="Toggle chat"
      className="fixed bottom-24 left-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
    >
      <MessageCircle className="h-6 w-6" />

      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 animate-pulse items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
