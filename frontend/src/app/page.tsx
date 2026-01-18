"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { nanoid } from "nanoid";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type Tab = "create" | "join";

function sanitizeRoomId(input: string) {
  // Keep it friendly: trim, remove spaces, keep common safe chars
  return input.trim().replace(/\s+/g, "").slice(0, 20);
}

export default function Home() {
  const router = useRouter();

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
    if (!userName.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);

    const newRoomId = nanoid(8);

    try {
      sessionStorage.setItem("userName", userName.trim());
    } catch {
      // ignore
    }

    router.push(`/room/${newRoomId}?create=true`);
  };

  const handleJoinRoom = async () => {
    const cleanRoomId = sanitizeRoomId(roomId);
    if (!cleanRoomId || !userName.trim()) return;

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
        sessionStorage.setItem("userName", userName.trim());
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
    <main className="min-h-screen gradient-bg text-white">
      {/* Top bar */}
      <header className="mx-auto max-w-6xl px-4 pt-6">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-linear-to-br from-(--primary) to-(--accent) flex items-center justify-center shadow-lg shadow-(--primary)/20">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </div>
            <div>
              <div className="text-lg font-bold leading-none">
                Ink<span className="text-(--primary)">Sync</span>
              </div>
              <div className="text-xs text-(--text-muted)">Real-time collaborative whiteboard</div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-sm text-(--text-muted)">
            <span className="px-3 py-1 rounded-full border border-(--border) bg-(--surface)/40">
              No sign-up required
            </span>
            <span className="px-3 py-1 rounded-full border border-(--border) bg-(--surface)/40">
              Shareable room codes
            </span>
          </div>
        </motion.div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-(--border) bg-(--surface)/40 text-sm text-(--text-muted)">
              <span className="w-2 h-2 rounded-full bg-(--primary) shadow-[0_0_0_6px_rgba(0,0,0,0.0)]" />
              Fast. Minimal. Built for collaboration.
            </div>

            <h1 className="mt-4 text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
              A clean whiteboard for{" "}
              <span className="text-(--primary)">teams</span>,{" "}
              <span className="text-(--primary)">classes</span>, and{" "}
              <span className="text-(--primary)">brainstorms</span>.
            </h1>

            <p className="mt-4 text-(--text-muted) text-lg max-w-xl">
              Create a room in seconds, share the code, and draw together in real-time—without friction.
            </p>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-xl">
              <Stat label="Latency" value="Low" />
              <Stat label="Collaborators" value="Up to 6" />
              <Stat label="Tools" value="Pen + Erase + Text" />
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
      {children}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-2">
        <label className="text-sm font-medium">{label}</label>
        {hint ? <span className="text-xs text-(--text-muted)">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function PrimaryButton({
  children,
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      className={`w-full py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2
      bg-(--primary) hover:bg-(--primary-hover) text-black
      disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {loading ? (
        <>
          <Spinner />
          <span>Working…</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block w-4 h-4 rounded-full border-2 border-black/40 border-t-black animate-spin"
      aria-label="Loading"
    />
  );
}

function FeatureCard({
  title,
  desc,
  icon,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-(--border) bg-(--surface)/40 backdrop-blur-sm p-5 hover:bg-(--surface)/60 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-(--surface) border border-(--border) flex items-center justify-center">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-(--text-muted) mt-1">{desc}</p>
        </div>
      </div>
    </div>
  );
}

function MiniPill({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-(--border) bg-(--surface)/40 p-4">
      <div className="flex items-start gap-3">
        <div className="text-xl" aria-hidden>
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">{title}</div>
          <div className="text-xs text-(--text-muted) mt-1">{desc}</div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-(--border) bg-(--surface)/35 p-4">
      <div className="text-xs text-(--text-muted)">{label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  );
}

function HowItWorks() {
  return (
    <div className="rounded-3xl border border-(--border) bg-(--surface)/35 p-6">
      <h3 className="text-lg font-semibold">How it works</h3>
      <ol className="mt-4 space-y-3 text-sm text-(--text-muted)">
        <li className="flex gap-3">
          <span className="w-7 h-7 rounded-xl bg-(--surface) border border-(--border) flex items-center justify-center text-white">
            1
          </span>
          <span>
            Create a room (or ask your friend for a code).
          </span>
        </li>
        <li className="flex gap-3">
          <span className="w-7 h-7 rounded-xl bg-(--surface) border border-(--border) flex items-center justify-center text-white">
            2
          </span>
          <span>
            Share the room ID—no accounts needed.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="w-7 h-7 rounded-xl bg-(--surface) border border-(--border) flex items-center justify-center text-white">
            3
          </span>
          <span>
            Draw together in real-time with synced tools.
          </span>
        </li>
      </ol>
    </div>
  );
}

function UseCases() {
  return (
    <div className="rounded-3xl border border-(--border) bg-(--surface)/35 p-6">
      <h3 className="text-lg font-semibold">Perfect for</h3>
      <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
        {[
          { t: "Team brainstorms", d: "Quick sketches + idea maps" },
          { t: "Teaching & tutoring", d: "Explain visually in seconds" },
          { t: "Product planning", d: "Flows, wireframes, user journeys" },
        ].map((x) => (
          <div
            key={x.t}
            className="rounded-2xl border border-(--border) bg-(--background)/50 p-4"
          >
            <div className="font-semibold">{x.t}</div>
            <div className="text-(--text-muted) text-xs mt-1">{x.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DesignNotes() {
  return (
    <div className="rounded-3xl border border-(--border) bg-(--surface)/35 p-6">
      <h3 className="text-lg font-semibold">Designed for clarity</h3>
      <p className="mt-4 text-sm text-(--text-muted)">
        This layout reduces clicks (tabs instead of modals), improves accessibility, and keeps
        the “Create / Join” flow obvious. It also keeps your existing API flow intact.
      </p>
      <div className="mt-4 rounded-2xl border border-(--border) bg-(--background)/50 p-4 text-xs text-(--text-muted)">
        Tip: Set <span className="text-white font-semibold">NEXT_PUBLIC_API_URL</span> in your
        environment for production deployments.
      </div>
    </div>
  );
}
