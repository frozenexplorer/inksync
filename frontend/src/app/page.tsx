"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { nanoid } from "nanoid";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function Home() {
  const router = useRouter();
  const { isSignedIn, user } = useUser();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    const name = isSignedIn ? (user?.firstName || user?.username || "User") : userName.trim();
    if (!name) return;
    setIsLoading(true);
    
    // Generate room ID locally for simplicity
    const newRoomId = nanoid(8);
    
    // Store username in sessionStorage for the room page
    sessionStorage.setItem("userName", name);
    
    // Add ?create=true to indicate this is a new room
    router.push(`/room/${newRoomId}?create=true`);
  };

  const handleJoinRoom = async () => {
    const name = isSignedIn ? (user?.firstName || user?.username || "User") : userName.trim();
    if (!roomId.trim() || !name) return;
    
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      // Check if room exists before navigating
      const response = await fetch(`${API_URL}/api/rooms/${roomId.trim()}`);
      
      if (!response.ok) {
        setErrorMessage(`Server error: ${response.status} ${response.statusText}`);
        setIsLoading(false);
        return;
      }
      
      const data = await response.json();
      
      if (!data.exists) {
        setErrorMessage(`Room "${roomId.trim()}" doesn't exist`);
        setIsLoading(false);
        return;
      }
      
      sessionStorage.setItem("userName", name);
      router.push(`/room/${roomId.trim()}`);
    } catch {
      setErrorMessage("Unable to connect to server. Please try again.");
      setIsLoading(false);
    }
  };

  const handleQuickStart = () => {
    const name = isSignedIn ? (user?.firstName || user?.username || "User") : "Guest";
    sessionStorage.setItem("userName", name);
    const newRoomId = nanoid(8);
    router.push(`/room/${newRoomId}?create=true`);
  };

  return (
    <main className="min-h-screen gradient-bg flex flex-col items-center justify-center p-4">
      {/* User button in top right */}
      {isSignedIn && (
        <div className="absolute top-4 right-4">
          <UserButton />
        </div>
      )}

      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#1a1a2e] mb-4">
          Web whiteboard for<br />instant collaboration.
        </h1>
        <p className="text-gray-600 text-lg md:text-xl max-w-md mx-auto">
          Sketch, brainstorm and share your ideas.<br />
          {isSignedIn ? "Your boards are saved automatically." : "No sign-up required."}
        </p>
      </motion.div>

      {/* Two Card Layout */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full"
      >
        {/* Guest Card */}
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 flex flex-col items-center text-center">
          <h2 className="text-2xl font-bold text-[#1a1a2e] mb-3">Web whiteboard</h2>
          <p className="text-gray-500 mb-6">
            No sign up required. Boards<br />expire after 24 hours.
          </p>
          <button
            onClick={handleQuickStart}
            className="w-full py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold rounded-xl transition-colors"
          >
            Start a whiteboard
          </button>
          <button
            onClick={() => setShowJoinModal(true)}
            className="w-full py-3 mt-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
          >
            Join existing room
          </button>
        </div>

        {/* Sign In Card */}
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 flex flex-col items-center text-center">
          <h2 className="text-2xl font-bold text-[#1a1a2e] mb-3">
            {isSignedIn ? `Welcome, ${user?.firstName || "User"}!` : "InkSync Pro"}
          </h2>
          <p className="text-gray-500 mb-6">
            {isSignedIn 
              ? "Your boards are saved. Create or join a room to continue."
              : "Save your boards forever. No time limits. Free account."
            }
          </p>
          {isSignedIn ? (
            <>
              <button
                onClick={() => setShowCreateModal(true)}
                className="w-full py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold rounded-xl transition-colors"
              >
                Create a room
              </button>
              <button
                onClick={() => setShowJoinModal(true)}
                className="w-full py-3 mt-3 border-2 border-[#4f46e5] text-[#4f46e5] hover:bg-[#4f46e5]/5 font-semibold rounded-xl transition-colors"
              >
                Join a room
              </button>
            </>
          ) : (
            <>
              <SignUpButton mode="modal">
                <button className="w-full py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold rounded-xl transition-colors">
                  Create a free account
                </button>
              </SignUpButton>
              <SignInButton mode="modal">
                <button className="w-full py-3 mt-3 border-2 border-[#4f46e5] text-[#4f46e5] hover:bg-[#4f46e5]/5 font-semibold rounded-xl transition-colors">
                  Sign in
                </button>
              </SignInButton>
            </>
          )}
        </div>
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
            className="text-center p-4 rounded-xl bg-white/80 border border-gray-200 shadow-sm"
          >
            <div className="text-2xl mb-2">{feature.icon}</div>
            <h3 className="font-semibold mb-1 text-[#1a1a2e]">{feature.title}</h3>
            <p className="text-sm text-gray-500">{feature.desc}</p>
          </div>
        ))}
      </motion.div>

      {/* Create Room Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <Modal onClose={() => setShowCreateModal(false)}>
            <h2 className="text-2xl font-bold mb-6 text-[#1a1a2e]">Create a Room</h2>
            <div className="space-y-4">
              {!isSignedIn && (
                <div>
                  <label className="block text-sm text-gray-500 mb-2">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#4f46e5] transition-colors text-[#1a1a2e]"
                    autoFocus
                    maxLength={20}
                  />
                </div>
              )}
              {isSignedIn && (
                <p className="text-gray-500">Creating room as <strong className="text-[#1a1a2e]">{user?.firstName || user?.username}</strong></p>
              )}
              <button
                onClick={handleCreateRoom}
                disabled={(!isSignedIn && !userName.trim()) || isLoading}
                className="w-full py-3 bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
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
          <Modal onClose={() => { setShowJoinModal(false); setErrorMessage(null); }}>
            <h2 className="text-2xl font-bold mb-6 text-[#1a1a2e]">Join a Room</h2>
            <div className="space-y-4">
              {!isSignedIn && (
                <div>
                  <label className="block text-sm text-gray-500 mb-2">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#4f46e5] transition-colors text-[#1a1a2e]"
                    autoFocus
                    maxLength={20}
                  />
                </div>
              )}
              {isSignedIn && (
                <p className="text-gray-500">Joining as <strong className="text-[#1a1a2e]">{user?.firstName || user?.username}</strong></p>
              )}
              <div>
                <label className="block text-sm text-gray-500 mb-2">
                  Room ID
                </label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => { setRoomId(e.target.value); setErrorMessage(null); }}
                  placeholder="Enter room ID"
                  className={`w-full px-4 py-3 bg-gray-50 border rounded-lg focus:outline-none transition-colors text-[#1a1a2e] ${
                    errorMessage ? "border-red-500" : "border-gray-200 focus:border-[#4f46e5]"
                  }`}
                  autoFocus={isSignedIn}
                  maxLength={20}
                />
              </div>
              
              {/* Error Message */}
              <AnimatePresence>
                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg"
                  >
                    <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-sm text-red-400">{errorMessage}</span>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <button
                onClick={handleJoinRoom}
                disabled={(!isSignedIn && !userName.trim()) || !roomId.trim() || isLoading}
                className="w-full py-3 bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                {isLoading ? "Checking..." : "Join Room"}
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
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
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
