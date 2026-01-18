"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { nanoid } from "nanoid";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type Tab = "create" | "join";

function sanitizeRoomId(input: string) {
  // Keep it friendly: trim, remove spaces, keep common safe chars
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

  // Prefill name if user already used the app before (nice UX)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("userName");
      if (saved && !userName) setUserName(saved);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear errors when switching tabs / editing fields
  useEffect(() => {
    setErrorMessage(null);
    setIsLoading(false);
  }, [tab]);

  const canCreate = useMemo(() => userName.trim().length > 0 && !isLoading, [userName, isLoading]);
  const canJoin = useMemo(
    () => userName.trim().length > 0 && sanitizeRoomId(roomId).length > 0 && !isLoading,
    [userName, roomId, isLoading]
  );

  const handleCreateRoom = async () => {
    const name = isSignedIn ? (user?.firstName || user?.username || "User") : userName.trim();
    if (!name) return;
    setIsLoading(true);
    setErrorMessage(null);

    const newRoomId = nanoid(8);

    try {
      sessionStorage.setItem("userName", name);
    } catch {
      // ignore
    }

    router.push(`/room/${newRoomId}?create=true`);
  };

  const handleJoinRoom = async () => {
    const name = isSignedIn ? (user?.firstName || user?.username || "User") : userName.trim();
    const cleanRoomId = sanitizeRoomId(roomId);
    if (!cleanRoomId || !name) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_URL}/api/rooms/${cleanRoomId}`, {
        method: "GET",
      });

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
        sessionStorage.setItem("userName", name);
      } catch {
        // ignore
      }

      router.push(`/room/${cleanRoomId}`);
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === "create") return handleCreateRoom();
    return handleJoinRoom();
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

          {/* Main card (Tabs + Form) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1, ease: "easeOut" }}
            className="relative"
          >
            <div className="absolute -inset-1 rounded-3xl bg-linear-to-br from-(--primary)/30 via-transparent to-(--accent)/25 blur-2xl opacity-70" />
            <div className="relative rounded-3xl border border-(--border) bg-(--background)/70 backdrop-blur-xl shadow-2xl p-6 md:p-7">
              {/* Tabs */}
              <div className="flex items-center gap-2 p-1 rounded-2xl bg-(--surface)/60 border border-(--border)">
                <TabButton active={tab === "create"} onClick={() => setTab("create")}>
                  Create Room
                </TabButton>
                <TabButton active={tab === "join"} onClick={() => setTab("join")}>
                  Join Room
                </TabButton>
              </div>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <Field
                  label="Your name"
                  hint="This will be visible to others in the room."
                >
                  <input
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="e.g. Mayukh"
                    maxLength={20}
                    className="w-full px-4 py-3 rounded-xl bg-(--surface) border border-(--border) focus:outline-none focus:border-(--primary) transition-colors"
                    autoComplete="name"
                  />
                </Field>

                <AnimatePresence mode="popLayout">
                  {tab === "join" && (
                    <motion.div
                      key="join-fields"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Field
                        label="Room ID"
                        hint="Paste the code shared by the host."
                      >
                        <input
                          value={roomId}
                          onChange={(e) => {
                            setRoomId(e.target.value);
                            setErrorMessage(null);
                          }}
                          placeholder="e.g. aB3k9X1z"
                          maxLength={20}
                          className={`w-full px-4 py-3 rounded-xl bg-(--surface) border focus:outline-none transition-colors ${
                            errorMessage
                              ? "border-red-500"
                              : "border-(--border) focus:border-(--primary)"
                          }`}
                          autoComplete="off"
                          inputMode="text"
                        />
                      </Field>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error */}
                <AnimatePresence>
                  {errorMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="flex items-start gap-2 px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10"
                    >
                      <svg
                        className="w-4 h-4 text-red-400 mt-0.5 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      <p className="text-sm text-red-300">{errorMessage}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Primary action */}
                {tab === "create" ? (
                  <PrimaryButton type="submit" disabled={!canCreate} loading={isLoading}>
                    Create & Start Drawing
                  </PrimaryButton>
                ) : (
                  <PrimaryButton type="submit" disabled={!canJoin} loading={isLoading}>
                    Verify & Join Room
                  </PrimaryButton>
                )}

                <div className="pt-2 text-xs text-(--text-muted) flex items-center justify-between">
                  <span>
                    {tab === "create"
                      ? "A new room code is generated instantly."
                      : "We verify the room exists before joining."}
                  </span>
                  <span className="hidden sm:inline">Press Enter to continue</span>
                </div>
              </form>

              {/* Quick trust row */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MiniPill icon="🔒" title="Private by default" desc="Room codes required" />
                <MiniPill icon="⚡" title="Instant sync" desc="Real-time updates" />
                <MiniPill icon="🎯" title="Focused tools" desc="No clutter UI" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features / How it works */}
      <section className="mx-auto max-w-6xl px-4 pb-14">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <FeatureCard
            title="Real-time collaboration"
            desc="Everyone sees updates instantly—perfect for meetings and teaching."
            icon={
              <span className="text-2xl" aria-hidden>
                ⚡
              </span>
            }
          />
          <FeatureCard
            title="Polished drawing experience"
            desc="Pen + eraser + text tools designed for speed and clarity."
            icon={
              <span className="text-2xl" aria-hidden>
                🎨
              </span>
            }
          />
          <FeatureCard
            title="Room-based workflow"
            desc="Create a code, share it, and collaborate with up to 6 people."
            icon={
              <span className="text-2xl" aria-hidden>
                👥
              </span>
            }
          />
        </motion.div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <HowItWorks />
          <UseCases />
          <DesignNotes />
        </div>
      </section>

      <footer className="border-t border-(--border) bg-(--background)/40">
        <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between text-sm text-(--text-muted)">
          <span>© {new Date().getFullYear()} InkSync</span>
          <span className="opacity-80">Built for fast collaboration • Minimal, modern UI</span>
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
      className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
        active
          ? "bg-(--primary) text-black shadow-lg shadow-(--primary)/20"
          : "text-(--text-muted) hover:text-white hover:bg-(--surface-hover)"
      }`}
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
