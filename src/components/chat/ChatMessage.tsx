'use client';

import type { ChatMessage as ChatMessageType } from '@/types';

interface ChatMessageProps {
  message: ChatMessageType;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.sender === 'user';

  return (
    <div
      className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className="max-w-[80%]">
        <div
          className={`px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'rounded-tl-2xl rounded-tr-sm rounded-bl-2xl rounded-br-2xl bg-indigo-600 text-white'
              : 'rounded-tl-sm rounded-tr-2xl rounded-bl-2xl rounded-br-2xl bg-gray-100 text-gray-800'
          }`}
        >
          {message.text}
        </div>
        <p
          className={`mt-1 text-xs text-gray-400 ${
            isUser ? 'text-right' : 'text-left'
          }`}
        >
          {formatTimestamp(message.timestamp)}
        </p>
      </div>
    </div>
  );
}
