'use client';

import { QUICK_REPLIES } from '@/store/chat';

interface QuickRepliesProps {
  onSelect: (reply: (typeof QUICK_REPLIES)[number]) => void;
}

export default function QuickReplies({ onSelect }: QuickRepliesProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {QUICK_REPLIES.map((reply) => (
        <button
          key={reply.label}
          type="button"
          onClick={() => onSelect(reply)}
          className="shrink-0 rounded-full border border-indigo-200 bg-white px-4 py-2 text-sm text-indigo-600 transition-colors hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1"
        >
          {reply.label}
        </button>
      ))}
    </div>
  );
}
