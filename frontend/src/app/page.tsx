"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { nanoid } from "nanoid";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type Tab = "create" | "join";

function sanitizeRoomId(input: string) {
  return input.trim().replace(/\s+/g, "").slice(0, 20);
}

export default function Home() {
  const router = useRouter();
  const { isSignedIn, user } = useUser();

  const [tab, setTab] = useState<Tab>("create");
  const [userName, setUserName] = useState("");
  const [roomId, setRoomId] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Prefill name from Clerk or sessionStorage
  useEffect(() => {
    if (isSignedIn && user) {
      const name = user.firstName || user.username || "User";
      setUserName(name);
    } else {
      try {
        const saved = sessionStorage.getItem("userName");
        if (saved && !userName) setUserName(saved);
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, user]);

  // Clear errors when switching tabs
  useEffect(() => {
    setErrorMessage(null);
    setIsLoading(false);
  }, [tab]);

  const displayName = isSignedIn ? (user?.firstName || user?.username || "User") : userName.trim();
  const canCreate = useMemo(() => displayName.length > 0 && !isLoading, [displayName, isLoading]);
  const canJoin = useMemo(
    () => displayName.length > 0 && sanitizeRoomId(roomId).length > 0 && !isLoading,
    [displayName, roomId, isLoading]
  );

  const handleCreateRoom = async () => {
    if (!displayName) return;
    setIsLoading(true);
    setErrorMessage(null);

    const newRoomId = nanoid(8);

    try {
      sessionStorage.setItem("userName", displayName);
    } catch {
      // ignore
    }

    router.push(`/room/${newRoomId}?create=true`);
  };

  const handleJoinRoom = async () => {
    const cleanRoomId = sanitizeRoomId(roomId);
    if (!cleanRoomId || !displayName) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_URL}/api/rooms/${cleanRoomId}`);

      if (!response.ok) {
        setErrorMessage(`Server error: ${response.status} ${response.statusText}`);
        setIsLoading(false);
        return;
      }

      const data = await response.json();

      if (!data?.exists) {
        setErrorMessage(`Room "${cleanRoomId}" doesn't exist`);
        setIsLoading(false);
        return;
      }

      try {
        sessionStorage.setItem("userName", displayName);
      } catch {
        // ignore
      }

      router.push(`/room/${cleanRoomId}`);
    } catch {
      setErrorMessage("Unable to connect to server. Please try again.");
      setIsLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === "create") return handleCreateRoom();
    return handleJoinRoom();
  };

  return (
    <main className="min-h-screen gradient-bg flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-linear-to-br from-[#4f46e5] to-[#7c3aed] flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <span className="font-bold text-lg">InkSync</span>
        </div>
        
        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <UserButton />
          ) : (
            <>
              <SignInButton mode="modal">
                <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-4 py-2 text-sm font-semibold bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-lg transition-colors">
                  Sign up free
                </button>
              </SignUpButton>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#1a1a2e] mb-4">
            Web whiteboard for<br />instant collaboration.
          </h1>
          <p className="text-gray-600 text-lg md:text-xl max-w-md mx-auto">
            Sketch, brainstorm and share your ideas.
            {isSignedIn ? (
              <><br />Your boards are saved automatically.</>
            ) : (
              <><br />No sign-up required.</>
            )}
          </p>
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6">
            {/* Auth Status Banner */}
            {isSignedIn ? (
              <div className="mb-4 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                ✓ Signed in as <strong>{user?.firstName || user?.username}</strong> — boards saved forever
              </div>
            ) : (
              <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                Guest mode — boards expire in 24 hours
              </div>
            )}

            {/* Tabs */}
            <div className="flex items-center gap-2 p-1 rounded-xl bg-gray-100">
              <TabButton active={tab === "create"} onClick={() => setTab("create")}>
                Create Room
              </TabButton>
              <TabButton active={tab === "join"} onClick={() => setTab("join")}>
                Join Room
              </TabButton>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {/* Name field - only show for guests */}
              {!isSignedIn && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Your name
                  </label>
                  <input
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="e.g. Alex"
                    maxLength={20}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/20 transition-all text-gray-900"
                    autoComplete="name"
                  />
                </div>
              )}

              {/* Room ID field - only for join */}
              <AnimatePresence mode="popLayout">
                {tab === "join" && (
                  <motion.div
                    key="join-field"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Room ID
                    </label>
                    <input
                      value={roomId}
                      onChange={(e) => {
                        setRoomId(e.target.value);
                        setErrorMessage(null);
                      }}
                      placeholder="e.g. aB3k9X1z"
                      maxLength={20}
                      className={`w-full px-4 py-3 rounded-xl bg-gray-50 border focus:outline-none focus:ring-2 transition-all text-gray-900 ${
                        errorMessage
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                          : "border-gray-200 focus:border-[#4f46e5] focus:ring-[#4f46e5]/20"
                      }`}
                      autoComplete="off"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error Message */}
              <AnimatePresence>
                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex items-start gap-2 px-3 py-2 rounded-xl border border-red-200 bg-red-50"
                  >
                    <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm text-red-600">{errorMessage}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={tab === "create" ? !canCreate : !canJoin}
                className="w-full py-3.5 bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {tab === "create" ? "Creating..." : "Joining..."}
                  </>
                ) : (
                  tab === "create" ? "Create & Start Drawing" : "Join Room"
                )}
              </button>
            </form>
          </div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl"
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
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white/50">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row gap-2 items-center justify-between text-sm text-gray-500">
          <span>© {new Date().getFullYear()} InkSync</span>
          <span>Built for fast collaboration • Minimal, modern UI</span>
        </div>
      </footer>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
        active
          ? "bg-[#4f46e5] text-white shadow-sm"
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}
