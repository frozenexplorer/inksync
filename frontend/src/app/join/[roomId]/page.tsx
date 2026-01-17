"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const [userName, setUserName] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;
    
    setIsJoining(true);
    sessionStorage.setItem("userName", userName.trim());
    router.push(`/room/${roomId}`);
  };

  const handleGoHome = () => {
    router.push("/");
  };

  return (
    <main className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-[var(--background)] border border-[var(--border)] rounded-2xl p-8 w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Join Whiteboard</h1>
          <p className="text-[var(--text-muted)]">
            You&apos;ve been invited to collaborate
          </p>
        </div>

        {/* Room info */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 mb-6">
          <div className="text-sm text-[var(--text-muted)] mb-1">Room Code</div>
          <div className="font-mono text-xl tracking-wider text-[var(--primary)]">
            {roomId}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--primary)] transition-colors text-lg"
              autoFocus
              maxLength={20}
            />
          </div>
          
          <button
            type="submit"
            disabled={!userName.trim() || isJoining}
            className="w-full py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-colors"
          >
            {isJoining ? "Joining..." : "Join Room"}
          </button>
          
          <button
            type="button"
            onClick={handleGoHome}
            className="w-full py-3 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] font-medium rounded-lg transition-colors"
          >
            Go to Home
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-[var(--text-muted)] mt-6">
          Powered by InkSync
        </p>
      </motion.div>
    </main>
  );
}
