"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (content: string) => void;
  messages: ChatMessage[];
  userId: string | null;
}

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

export function ChatPanel({
  isOpen,
  onClose,
  onSend,
  messages,
  userId,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSend(trimmed.slice(0, 500));
    setDraft("");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="fixed left-2 right-2 top-16 z-40 sm:left-auto sm:right-4 sm:w-[360px]"
        >
          <div className="bg-[var(--surface)]/95 border border-[var(--border)] rounded-2xl shadow-2xl backdrop-blur flex flex-col h-[70vh] max-h-[520px]">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--primary)] shadow-[0_0_8px_rgba(78,205,196,0.45)]" />
                <span className="text-sm font-semibold">Room Chat</span>
              </div>
              <button
                onClick={onClose}
                className="text-[var(--text-muted)] hover:text-white transition-colors"
                aria-label="Close chat"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 ? (
                <div className="text-sm text-[var(--text-muted)]">
                  No messages yet. Say hello.
                </div>
              ) : (
                messages.map((message) => {
                  const isOwn = Boolean(userId && message.userId === userId);
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                          isOwn
                            ? "bg-[var(--primary)] text-black"
                            : "bg-[var(--background)] border border-[var(--border)]"
                        }`}
                      >
                        <div
                          className={`mb-1 flex items-center gap-2 text-xs ${
                            isOwn ? "text-black/70" : "text-[var(--text-muted)]"
                          }`}
                        >
                          <span
                            className="font-medium"
                            style={!isOwn ? { color: message.userColor } : undefined}
                          >
                            {isOwn ? "You" : message.userName}
                          </span>
                          <span className="opacity-70">
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                        <div className="whitespace-pre-wrap break-words">
                          {message.content}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={endRef} />
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-3 border-t border-[var(--border)] flex items-center gap-2"
            >
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Message the room..."
                maxLength={500}
                className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--primary)] transition-colors"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="px-3 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-medium rounded-lg transition-colors"
              >
                Send
              </button>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
