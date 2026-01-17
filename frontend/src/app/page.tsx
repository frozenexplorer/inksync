"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { nanoid } from "nanoid";

export default function Home() {
  const router = useRouter();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateRoom = async () => {
    if (!userName.trim()) return;
    setIsLoading(true);
    
    // Generate room ID locally for simplicity
    const newRoomId = nanoid(8);
    
    // Store username in sessionStorage for the room page
    sessionStorage.setItem("userName", userName.trim());
    
    router.push(`/room/${newRoomId}`);
  };

  const handleJoinRoom = () => {
    if (!roomId.trim() || !userName.trim()) return;
    
    sessionStorage.setItem("userName", userName.trim());
    router.push(`/room/${roomId.trim()}`);
  };

  return (
    <main className="min-h-screen gradient-bg flex flex-col items-center justify-center p-4">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center mb-12"
      >
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center">
            <svg 
              className="w-7 h-7 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" 
              />
            </svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Ink<span className="text-[var(--primary)]">Sync</span>
          </h1>
        </div>
        <p className="text-[var(--text-muted)] text-lg md:text-xl max-w-md mx-auto">
          Draw, collaborate, and create together in real-time
        </p>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-8 py-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-semibold rounded-xl transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-[var(--primary)]/20"
        >
          Create Room
        </button>
        <button
          onClick={() => setShowJoinModal(true)}
          className="px-8 py-4 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] font-semibold rounded-xl transition-all duration-200 hover:scale-105"
        >
          Join Room
        </button>
      </motion.div>

      {/* Features */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl"
      >
        {[
          { icon: "⚡", title: "Real-time Sync", desc: "Instant collaboration" },
          { icon: "🎨", title: "Drawing Tools", desc: "Pen, eraser, text" },
          { icon: "👥", title: "Multi-user", desc: "Up to 6 collaborators" },
        ].map((feature, i) => (
          <div
            key={i}
            className="text-center p-4 rounded-xl bg-[var(--surface)]/50 border border-[var(--border)]/50"
          >
            <div className="text-2xl mb-2">{feature.icon}</div>
            <h3 className="font-semibold mb-1">{feature.title}</h3>
            <p className="text-sm text-[var(--text-muted)]">{feature.desc}</p>
          </div>
        ))}
      </motion.div>

      {/* Create Room Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <Modal onClose={() => setShowCreateModal(false)}>
            <h2 className="text-2xl font-bold mb-6">Create a Room</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
                  autoFocus
                  maxLength={20}
                />
              </div>
              <button
                onClick={handleCreateRoom}
                disabled={!userName.trim() || isLoading}
                className="w-full py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-colors"
              >
                {isLoading ? "Creating..." : "Create Room"}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Join Room Modal */}
      <AnimatePresence>
        {showJoinModal && (
          <Modal onClose={() => setShowJoinModal(false)}>
            <h2 className="text-2xl font-bold mb-6">Join a Room</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
                  autoFocus
                  maxLength={20}
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">
                  Room ID
                </label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Enter room ID"
                  className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
                  maxLength={20}
                />
              </div>
              <button
                onClick={handleJoinRoom}
                disabled={!userName.trim() || !roomId.trim()}
                className="w-full py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-colors"
              >
                Join Room
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </main>
  );
}

function Modal({ 
  children, 
  onClose 
}: { 
  children: React.ReactNode; 
  onClose: () => void;
}) {
  return (
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
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {children}
      </motion.div>
    </motion.div>
  );
}
