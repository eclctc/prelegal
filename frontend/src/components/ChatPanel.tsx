"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/chat";

interface ChatPanelProps {
  messages: ChatMessage[];
  pending: boolean;
  error: string | null;
  onSend: (text: string) => void;
}

export default function ChatPanel({ messages, pending, error, onSend }: ChatPanelProps) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, pending]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setText("");
    onSend(trimmed);
  };

  return (
    <section aria-label="Chat" className="flex h-full min-h-0 flex-col">
      <div role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto pb-3">
        {messages.map((m, i) => (
          <p
            key={i}
            className={
              m.role === "user"
                ? "ml-8 rounded-lg bg-[#209dd7] px-3 py-2 text-sm text-white"
                : "mr-8 rounded-lg bg-slate-100 px-3 py-2 text-sm text-[#032147]"
            }
          >
            {m.content}
          </p>
        ))}
        {pending && <p className="text-sm text-[#888888]">Thinking...</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-slate-200 pt-3">
        <input
          aria-label="Message"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your reply"
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="rounded-md bg-[#753991] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </section>
  );
}
