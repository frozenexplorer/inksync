"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

export function ShareModal({ isOpen, onClose, roomId }: ShareModalProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const inviteLink = typeof window !== "undefined" 
    ? `${window.location.origin}/join/${roomId}`
    : "";

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-[var(--background)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <svg className="w-5 h-5 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share Room
              </h2>
              <button
                onClick={onClose}
                className="text-[var(--text-muted)] hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Room Code */}
            <div className="mb-4">
              <label className="block text-sm text-[var(--text-muted)] mb-2">
                Room Code
              </label>
              <div className="flex gap-2">
                <div className="flex-1 px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-mono text-lg tracking-wider">
                  {roomId}
                </div>
                <button
                  onClick={handleCopyCode}
                  className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                    copiedCode 
                      ? "bg-green-500 text-white" 
                      : "bg-[var(--surface-hover)] hover:bg-[var(--primary)] hover:text-black border border-[var(--border)]"
                  }`}
                >
                  {copiedCode ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Invite Link */}
            <div className="mb-6">
              <label className="block text-sm text-[var(--text-muted)] mb-2">
                Invite Link
              </label>
              <div className="flex gap-2">
                <div className="flex-1 px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm truncate text-[var(--text-muted)]">
                  {inviteLink}
                </div>
                <button
                  onClick={handleCopyLink}
                  className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                    copiedLink 
                      ? "bg-green-500 text-white" 
                      : "bg-[var(--surface-hover)] hover:bg-[var(--primary)] hover:text-black border border-[var(--border)]"
                  }`}
                >
                  {copiedLink ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-xl p-4">
              <h3 className="font-medium mb-2 text-sm">How to invite others:</h3>
              <ul className="text-sm text-[var(--text-muted)] space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--primary)]">1.</span>
                  Share the invite link directly, or
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--primary)]">2.</span>
                  Share the room code - others can enter it on the home page
                </li>
              </ul>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
