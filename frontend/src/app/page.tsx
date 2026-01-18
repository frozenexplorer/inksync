"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { nanoid } from "nanoid";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Tab = "create" | "join";
type RightTab = "guide" | "share" | "shortcuts";

function sanitizeRoomId(input: string) {
  return input.trim().replace(/\s+/g, "").slice(0, 20);
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
  return letters || "U";
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="px-2 py-0.5 rounded-md border border-[var(--border)] bg-[var(--surface-hover)] text-[10px] font-medium text-[var(--text-muted)]">
      {children}
    </kbd>
  );
}

function IconButton({
  onClick,
  label,
  pressed,
  children,
  className,
}: {
  onClick: () => void;
  label: string;
  pressed?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className={cx(
        "relative w-9 h-9 rounded-xl border border-[var(--border)] flex items-center justify-center transition-all",
        "bg-[var(--surface)]/60 backdrop-blur-xl hover:bg-[var(--surface-hover)]/80 hover:shadow-sm",
        pressed ? "ring-2 ring-[var(--primary)]/45" : "",
        className
      )}
    >
      <span className={cx("transition-colors", pressed ? "text-[var(--text)]" : "text-[var(--text-muted)]")}>
        {children}
      </span>
    </button>
  );
}

/** Smooth premium 3D tilt wrapper */
function TiltSurface({
  children,
  className,
  intensity = 10,
}: {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  const sx = useSpring(mx, { stiffness: 220, damping: 26, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 220, damping: 26, mass: 0.6 });

  const rotateY = useTransform(sx, [-0.5, 0.5], [-intensity, intensity]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [intensity * 0.85, -intensity * 0.85]);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    mx.set(px - 0.5);
    my.set(py - 0.5);
  };

  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <div
      style={{ perspective: 1200 }}
      className={cx("relative", className)}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <motion.div style={{ rotateX, rotateY, transformStyle: "preserve-3d" }} className="will-change-transform">
        {children}
      </motion.div>
    </div>
  );
}

/** Background: subtle grid + floating glows (HD/retina-friendly) */
function PremiumBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/25" />

      {/* Soft grid (masked) */}
      <div
        className="absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(circle at 35% 22%, black 55%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(circle at 35% 22%, black 55%, transparent 80%)",
        }}
      />

      {/* Glows */}
      <motion.div
        className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full blur-3xl opacity-25"
        style={{
          background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35), rgba(255,255,255,0) 60%)",
        }}
        animate={{ x: [0, 42, 0], y: [0, 18, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-44 right-[-160px] w-[620px] h-[620px] rounded-full blur-3xl opacity-25"
        style={{
          background: "radial-gradient(circle at 40% 40%, rgba(255,255,255,0.30), rgba(255,255,255,0) 65%)",
        }}
        animate={{ x: [0, -55, 0], y: [0, -32, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

function BadgePill({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)]/65 backdrop-blur-xl text-xs text-[var(--text-muted)]">
      <span>{icon}</span>
      <span className="font-medium">{label}</span>
    </span>
  );
}

function InfoCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl p-4">
      <div className="text-xs font-semibold text-[var(--text)]">{title}</div>
      <div className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">{desc}</div>
    </div>
  );
}

/** Simple typewriter effect (client-only, safe in Next "use client") */
function Typewriter({
  words,
  className,
  typingMs = 55,
  deletingMs = 32,
  pauseMs = 900,
  cursor = true,
}: {
  words: string[];
  className?: string;
  typingMs?: number;
  deletingMs?: number;
  pauseMs?: number;
  cursor?: boolean;
}) {
  const [wordIndex, setWordIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [paused, setPaused] = useState(false);

  const current = words[wordIndex] ?? "";

  useEffect(() => {
    if (!words.length) return;

    if (paused) {
      const t = window.setTimeout(() => setPaused(false), pauseMs);
      return () => window.clearTimeout(t);
    }

    const doneTyping = charCount >= current.length;
    const doneDeleting = charCount <= 0;

    const delay = deleting ? deletingMs : typingMs;

    const t = window.setTimeout(() => {
      if (!deleting) {
        // typing
        if (!doneTyping) {
          setCharCount((c) => c + 1);
        } else {
          setPaused(true);
          setDeleting(true);
        }
      } else {
        // deleting
        if (!doneDeleting) {
          setCharCount((c) => c - 1);
        } else {
          setDeleting(false);
          setWordIndex((i) => (i + 1) % words.length);
        }
      }
    }, delay);

    return () => window.clearTimeout(t);
  }, [words, wordIndex, charCount, deleting, paused, current.length, typingMs, deletingMs, pauseMs]);

  const text = current.slice(0, charCount);

  return (
    <span className={cx("inline-flex items-baseline", className)} aria-live="polite">
      <span className="whitespace-nowrap">{text}</span>
      {cursor && (
        <motion.span
          className="ml-1 inline-block w-[10px] h-[1.15em] align-bottom rounded-sm bg-(--primary)/80"
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </span>
  );
}

export default function Home() {
  const router = useRouter();
  const { isSignedIn, user } = useUser();

  const [tab, setTab] = useState<Tab>("create");
  const [userName, setUserName] = useState("");
  const [roomId, setRoomId] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<RightTab>("guide");
  const [rightOpen, setRightOpen] = useState(true);

  // Platform + origin
  const [isMac, setIsMac] = useState(false);
  const [origin, setOrigin] = useState<string>("");
  const [isDesktop, setIsDesktop] = useState(false); // >= lg

  useEffect(() => {
    try {
      setIsMac(navigator.platform.toLowerCase().includes("mac"));
    } catch {}
    try {
      setOrigin(window.location.origin);
    } catch {}

    // Responsive sidebar behavior:
    // - Desktop: open by default
    // - Mobile/tablet: closed by default
    try {
      const mq = window.matchMedia("(min-width: 1024px)");
      const apply = () => {
        setIsDesktop(mq.matches);
        setRightOpen(mq.matches);
      };
      apply();
      mq.addEventListener?.("change", apply);
      return () => mq.removeEventListener?.("change", apply);
    } catch {
      // ignore
    }
  }, []);

  // Prefill name from Clerk or sessionStorage (CORE LOGIC UNCHANGED)
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

  // Clear errors when switching tabs (CORE LOGIC UNCHANGED)
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

  const copyToClipboard = useCallback(async (text: string, successMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log(successMsg);
    } catch {
      console.log("Could not copy to clipboard.");
    }
  }, []);

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
      // Store username in sessionStorage
      sessionStorage.setItem("userName", displayName);
      
      // Try to validate room exists via REST API (optional check)
      // If this fails (CORS, network, etc.), we still allow navigation
      // and let the socket handler validate on connection
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
        
        const response = await fetch(`${API_URL}/api/rooms/${cleanRoomId}`, {
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          if (!data?.exists) {
            setErrorMessage(`Room "${cleanRoomId}" doesn't exist`);
            setIsLoading(false);
            return;
          }
        }
        // If response is not ok, continue anyway - socket will validate
      } catch (apiError) {
        // API check failed (CORS, network, timeout, etc.)
        // This is OK - we'll let socket handler validate instead
        console.log('Room validation API check failed, will validate via socket:', apiError);
      }
      
      // Navigate to room - socket handler will validate if API check didn't work
      router.push(`/room/${cleanRoomId}`);
    } catch (error) {
      setErrorMessage("Unable to connect to server. Please try again.");
      setIsLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === "create") return handleCreateRoom();
    return handleJoinRoom();
  };

  const openRight = useCallback((t: RightTab) => {
    setRightOpen(true);
    setActiveTab(t);
  }, []);

  const toggleRight = useCallback(() => {
    setRightOpen((prev) => !prev);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) {
        if (e.key !== "Escape") return; // Allow Escape to close sidebar
      }

      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === "Escape") {
        setRightOpen(false);
        return;
      }

      if (!mod) return;

      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggleRight();
        return;
      }

      if (e.key.toLowerCase() === "j") {
        e.preventDefault();
        setTab("join");
        return;
      }

      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setTab("create");
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        openRight("guide");
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMac, openRight, toggleRight]);

  const sidebarVariants = isDesktop
    ? {
        hidden: { x: 380, opacity: 0 },
        show: { x: 0, opacity: 1 },
        exit: { x: 380, opacity: 0 },
      }
    : {
        hidden: { y: 420, opacity: 0 },
        show: { y: 0, opacity: 1 },
        exit: { y: 420, opacity: 0 },
      };

  const heroPhrases = useMemo(() => ["teams", "classrooms", "workshops", "study groups"], []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-(--background) flex flex-col relative">
      <PremiumBackdrop />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="h-14 border-b border-(--border) bg-(--surface)/75 backdrop-blur-xl flex items-center justify-between px-3 sm:px-5 shrink-0 relative z-30"
      >
        {/* Left: Brand */}
        <div className="flex items-center gap-3 min-w-0">
          <TiltSurface intensity={8} className="shrink-0">
            <div
              className={cx(
                "w-10 h-10 rounded-2xl border border-white/10 overflow-hidden",
                "bg-linear-to-br from-(--primary)/90 via-(--accent)/75 to-white/15",
                "shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
              )}
              style={{ transform: "translateZ(12px)" }}
            >
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536M9 11l6-6m-5 9H7a2 2 0 00-2 2v3h3a2 2 0 002-2v-1m8-8a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </div>
            </div>
          </TiltSurface>

          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="font-semibold text-sm truncate tracking-wide text-(--text)">InkSync</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-(--border) bg-(--surface-hover)/60 text-(--text-muted)">
                Home
              </span>
            </div>
            {/* CHANGED: Built -> Built */}
            <div className="text-xs text-(--text-muted) truncate">Realtime rooms • Clean tools • Built for focus</div>
          </div>
        </div>

        {/* Right: actions + auth */}
        <div className="flex items-center gap-2 sm:gap-3">
          <IconButton onClick={() => openRight("guide")} label="Open guide" pressed={rightOpen && activeTab === "guide"}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M12 14a4 4 0 10-4-4" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2z"
              />
            </svg>
          </IconButton>

          <IconButton onClick={() => openRight("share")} label="Open share" pressed={rightOpen && activeTab === "share"}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 6.5a3 3 0 105.367-2.684A3 3 0 0016 6.5zm0 11a3 3 0 105.368 2.684A3 3 0 0016 17.5z"
              />
            </svg>
          </IconButton>

          <IconButton
            onClick={() => openRight("shortcuts")}
            label="Open shortcuts"
            pressed={rightOpen && activeTab === "shortcuts"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </IconButton>

          {/* Auth (Clerk unchanged) */}
          {isSignedIn ? (
            <div className="flex items-center gap-2 border-l border-(--border) pl-3">
              <div className="hidden md:flex items-center gap-2 text-sm text-(--text-muted)">
                <div className="w-8 h-8 rounded-full border border-(--border) flex items-center justify-center text-xs font-semibold bg-(--surface-hover)/70">
                  {initials(user?.firstName || user?.username || "User")}
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-medium text-(--text)">{user?.firstName || user?.username || "User"}</span>
                  <span className="text-[10px] text-(--text-muted)">Signed in</span>
                </div>
              </div>
              <UserButton />
            </div>
          ) : (
            <>
              <SignInButton mode="modal">
                <button className="px-3 py-1.5 text-sm font-medium text-(--text-muted) hover:text-(--text) transition-colors">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-3 py-1.5 text-sm font-semibold bg-(--primary) hover:bg-(--primary-hover) text-black rounded-xl transition-colors shadow-sm">
                  Sign up free
                </button>
              </SignUpButton>
            </>
          )}
        </div>
      </motion.header>

      {/* Main */}
      <div className="flex-1 relative overflow-hidden z-10">
        {/* Content (only pad on desktop when sidebar open) */}
        <div className={cx("h-full overflow-auto", rightOpen && isDesktop ? "lg:pr-[390px]" : "")}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-start">
              {/* Hero */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
                className="relative"
              >
                {/* CHANGED: Realtime -> Realtime, Rooms -> Rooms */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-(--border) bg-(--surface)/65 backdrop-blur-xl text-xs text-(--text-muted)">
                  <span className="w-1.5 h-1.5 rounded-full bg-(--primary) shadow-[0_0_0_6px_rgba(255,255,255,0.05)]" />
                  <span className="font-medium text-(--text)">Realtime</span>
                  <span>•</span>
                  <span>Rooms you can share instantly</span>
                </div>

                {/* UPDATED HERO TITLE + TYPEWRITER */}
                <h2 className="mt-5 text-4xl sm:text-5xl font-bold tracking-tight text-(--text) leading-[1.05]">
                  A realtime whiteboard
                  <span className="block">
                    for{" "}
                    <span className="relative inline-flex items-baseline">
                      <Typewriter words={heroPhrases} className="text-(--text)" typingMs={52} deletingMs={30} pauseMs={920} />
                      <span className="absolute -bottom-1 left-0 right-0 h-[3px] bg-(--primary)/60 blur-[1px] rounded-full" />
                    </span>
                    .
                  </span>
                </h2>

                <p className="mt-4 text-(--text-muted) text-base sm:text-lg max-w-xl leading-relaxed">
                  Create a room, share a code, and collaborate in seconds — with a smooth, professional UI that stays out of the way.
                  {isSignedIn ? (
                    <span className="block mt-1">Your boards are saved automatically.</span>
                  ) : (
                    <span className="block mt-1">Start in guest mode — upgrade anytime.</span>
                  )}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <BadgePill icon="⚡" label="Realtime sync" />
                  <BadgePill icon="✍️" label="Ink • Text • Erase" />
                  <BadgePill icon="👥" label="Up to 6 people" />
                  <BadgePill icon="⌨️" label="Keyboard-first" />
                </div>

                {/* Professional add-on: “Quick Start” (replaces the removed live preview) */}
                <div className="mt-8 grid sm:grid-cols-3 gap-3">
                  <InfoCard title="1) Create / Join" desc="Start a fresh room or jump into an existing code instantly." />
                  <InfoCard title="2) Share the code" desc="Send the room code to teammates — no setup friction." />
                  <InfoCard title="3) Collaborate" desc="Draw together with synced tools and a clean workflow." />
                </div>

                <div className="mt-6 text-xs text-(--text-muted) flex items-center gap-2">
                  <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-(--border) bg-(--surface)/55 backdrop-blur-xl">
                    <span className="font-medium text-(--text)">Tip</span>
                    <span>Press</span>
                    <Kbd>{isMac ? "⌘K" : "Ctrl K"}</Kbd>
                    <span>to toggle the sidebar</span>
                  </span>
                </div>
              </motion.div>

              {/* Create/Join Card */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="relative"
              >
                <TiltSurface intensity={10}>
                  <div
                    className={cx(
                      "rounded-3xl border border-[var(--border)] bg-[var(--surface)]/70 backdrop-blur-xl overflow-hidden",
                      "shadow-[0_22px_80px_rgba(0,0,0,0.50)]"
                    )}
                    style={{ transform: "translateZ(16px)" }}
                  >
                    {/* Auth banner */}
                    <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--surface-hover)]/70 backdrop-blur-xl">
                      {isSignedIn ? (
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-200 text-sm">
                          <span className="text-base">✓</span>
                          Signed in as <strong className="text-[var(--text)]">{user?.firstName || user?.username}</strong>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
                          <span className="text-base">⚠</span>
                          Guest mode — Boards expire in 24 hours
                        </span>
                      )}
                    </div>

                    <div className="p-5">
                      {/* Tabs */}
                      <div className="flex items-center gap-2 p-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-hover)]/65 backdrop-blur-xl">
                        <button
                          type="button"
                          onClick={() => setTab("create")}
                          className={cx(
                            "flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border",
                            "focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50",
                            tab === "create"
                              ? "bg-[var(--primary)] text-black border-[var(--primary)] shadow-sm"
                              : "bg-[var(--surface)]/60 text-[var(--text-muted)] border-[var(--border)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                          )}
                        >
                          Create Room
                        </button>

                        <button
                          type="button"
                          onClick={() => setTab("join")}
                          className={cx(
                            "flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border",
                            "focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50",
                            tab === "join"
                              ? "bg-[var(--primary)] text-black border-[var(--primary)] shadow-sm"
                              : "bg-[var(--surface)]/60 text-[var(--text-muted)] border-[var(--border)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                          )}
                        >
                          Join Room
                        </button>
                      </div>

                      <form onSubmit={onSubmit} className="mt-5 space-y-4">
                        {/* Name (guest only) */}
                        {!isSignedIn && (
                          <div>
                            <label className="block text-sm font-medium text-[var(--text)] mb-1.5">Your name</label>
                            <input
                              value={userName}
                              onChange={(e) => setUserName(e.target.value)}
                              placeholder="e.g. Alex"
                              maxLength={20}
                              className={cx(
                                "w-full px-4 py-3 rounded-2xl",
                                "bg-[var(--surface-hover)]/70 backdrop-blur-xl border border-[var(--border)]",
                                "focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/60",
                                "text-[var(--text)] placeholder:text-[var(--text-muted)]"
                              )}
                              autoComplete="name"
                            />
                          </div>
                        )}

                        {/* Room ID only on join */}
                        <AnimatePresence mode="popLayout">
                          {tab === "join" && (
                            <motion.div
                              key="join-field"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <label className="block text-sm font-medium text-[var(--text)] mb-1.5">Room ID</label>
                              <input
                                value={roomId}
                                onChange={(e) => {
                                  setRoomId(e.target.value);
                                  setErrorMessage(null);
                                }}
                                placeholder="Paste a room code"
                                maxLength={20}
                                className={cx(
                                  "w-full px-4 py-3 rounded-2xl bg-[var(--surface-hover)]/70 backdrop-blur-xl border focus:outline-none focus:ring-2 text-[var(--text)] placeholder:text-[var(--text-muted)]",
                                  errorMessage
                                    ? "border-red-500/70 focus:ring-red-500/30"
                                    : "border-[var(--border)] focus:ring-[var(--primary)]/60"
                                )}
                                autoComplete="off"
                              />
                              <div className="mt-2 text-[10px] text-[var(--text-muted)]">Codes are case-sensitive. No spaces.</div>
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
                              className="flex items-start gap-2 px-3 py-2 rounded-2xl border border-red-500/30 bg-red-500/10"
                            >
                              <svg className="w-4 h-4 text-red-300 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                              </svg>
                              <p className="text-sm text-red-200">{errorMessage}</p>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Submit */}
                        <button
                          type="submit"
                          disabled={tab === "create" ? !canCreate : !canJoin}
                          className={cx(
                            "w-full py-3.5 rounded-2xl",
                            "bg-[var(--primary)] hover:bg-[var(--primary-hover)]",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            "text-black font-semibold transition-all flex items-center justify-center gap-2",
                            "shadow-[0_12px_44px_rgba(0,0,0,0.35)] hover:shadow-[0_18px_70px_rgba(0,0,0,0.45)]"
                          )}
                        >
                          {isLoading ? (
                            <>
                              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              {tab === "create" ? "Creating..." : "Joining..."}
                            </>
                          ) : tab === "create" ? (
                            "Create & Start Drawing"
                          ) : (
                            "Join Room"
                          )}
                        </button>

                        {/* Small pro details */}
                        <div className="pt-2 grid grid-cols-2 gap-2">
                          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl p-3">
                            <div className="text-[10px] text-[var(--text-muted)]">Workflow</div>
                            <div className="mt-1 text-xs font-semibold text-[var(--text)]">Room-based</div>
                          </div>
                          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 backdrop-blur-xl p-3">
                            <div className="text-[10px] text-[var(--text-muted)]">Shortcuts</div>
                            <div className="mt-1 text-xs font-semibold text-[var(--text)]">
                              <span className="inline-flex items-center gap-1">
                                <Kbd>{isMac ? "⌘N" : "Ctrl N"}</Kbd>
                                <span className="text-[10px] text-[var(--text-muted)]">Create</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                </TiltSurface>

                <div className="mt-6 text-xs text-[var(--text-muted)] flex items-center justify-between">
                  <span>© {new Date().getFullYear()} InkSync</span>
                  {/* CHANGED: Professional + Fast capitalized */}
                  <span className="hidden sm:inline">Minimal, Professional, Fast</span>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Mobile overlay when sidebar open */}
        <AnimatePresence>
          {rightOpen && !isDesktop && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-30"
              onClick={() => setRightOpen(false)}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>

        {/* Right Sidebar (desktop: right panel, mobile: bottom sheet) */}
        <AnimatePresence>
          {rightOpen && (
            <motion.aside
              key={isDesktop ? "desktop-aside" : "mobile-aside"}
              variants={sidebarVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className={cx(
                "absolute z-40 overflow-hidden flex flex-col",
                isDesktop ? "top-3 right-3 bottom-3 w-[360px] max-w-[90vw] rounded-3xl" : "left-3 right-3 bottom-3 top-auto max-h-[72vh] rounded-3xl"
              )}
              style={{
                border: "1px solid var(--border)",
                background: "color-mix(in srgb, var(--surface) 70%, transparent)",
                backdropFilter: "blur(18px)",
                boxShadow: "0 22px 90px rgba(0,0,0,0.60)",
              }}
              aria-label="Home sidebar"
            >
              {/* Sidebar top bar */}
              <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {(["guide", "share", "shortcuts"] as RightTab[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setActiveTab(t)}
                      className={cx(
                        "px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors capitalize",
                        activeTab === t
                          ? "bg-[var(--primary)] text-black border-[var(--primary)]"
                          : "bg-[var(--surface-hover)]/70 border-[var(--border)] hover:bg-[var(--surface)]/70"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                    <Kbd>{isMac ? "⌘K" : "Ctrl K"}</Kbd>
                    {/* CHANGED: remove "toggle" word */}
                  </div>

                  <button
                    onClick={() => setRightOpen(false)}
                    className="w-8 h-8 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)]/70 hover:bg-[var(--surface)]/70 flex items-center justify-center"
                    aria-label="Close sidebar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Sidebar content */}
              {activeTab === "guide" && (
                <div className="flex-1 overflow-auto p-4 space-y-4">
                  <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-hover)]/65 backdrop-blur-xl p-4">
                    <div className="text-sm font-semibold">Getting started</div>
                    <div className="mt-2 space-y-3 text-sm">
                      <div>
                        <div className="font-medium">⚡ Fast collaboration</div>
                        <div className="text-xs text-[var(--text-muted)]">
                          Create a room and share the code — everyone sees updates instantly.
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">🎯 Designed for clarity</div>
                        <div className="text-xs text-[var(--text-muted)]">
                          A clean interface that stays focused during meetings and teaching.
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">👥 Room workflow</div>
                        <div className="text-xs text-[var(--text-muted)]">
                          One room = one shared space. Simple, predictable, professional.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-[var(--border)] p-4 bg-[var(--surface)]/40 backdrop-blur-xl">
                    <div className="text-sm font-semibold">Quick steps</div>
                    <ol className="mt-2 space-y-2 text-xs text-[var(--text-muted)] list-decimal list-inside">
                      <li>Choose “Create Room” or “Join Room”.</li>
                      <li>Share the room code with your group.</li>
                      <li>Open the whiteboard and collaborate live.</li>
                    </ol>
                  </div>
                </div>
              )}

              {activeTab === "share" && (
                <div className="flex-1 overflow-auto p-4 space-y-4">
                  <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-hover)]/65 backdrop-blur-xl p-4">
                    <div className="text-sm font-semibold">Share your board</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">
                      Create a room, then share the room code shown in the board header.
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/55 p-3">
                        <div className="text-[10px] text-[var(--text-muted)]">Base URL</div>
                        <div className="text-xs truncate mt-1">{origin || "Loading…"}</div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[10px] text-[var(--text-muted)]">Copy base URL</div>
                          <div className="text-xs text-[var(--text-muted)]">Useful for sharing + troubleshooting</div>
                        </div>
                        <button
                          onClick={() => copyToClipboard(origin || "", "Base URL copied")}
                          className="px-3 py-2 rounded-2xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black text-xs font-medium transition-colors disabled:opacity-50"
                          disabled={!origin}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-[var(--border)] p-4 bg-[var(--surface)]/40 backdrop-blur-xl">
                    <div className="text-sm font-semibold">Sharing checklist</div>
                    <ul className="mt-2 space-y-2 text-xs text-[var(--text-muted)] list-disc list-inside">
                      <li>Send the room code (case-sensitive).</li>
                      <li>Keep the call open while collaborating.</li>
                      <li>Use “Join Room” to reconnect anytime.</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === "shortcuts" && (
                <div className="flex-1 overflow-auto p-4 space-y-4">
                  <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-hover)]/65 backdrop-blur-xl p-4">
                    <div className="text-sm font-semibold">Keyboard shortcuts</div>
                    <div className="mt-3 space-y-2 text-xs text-[var(--text-muted)]">
                      <div className="flex items-center justify-between">
                        <span>Toggle sidebar</span>
                        <Kbd>{isMac ? "⌘K" : "Ctrl K"}</Kbd>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Switch to Create</span>
                        <Kbd>{isMac ? "⌘N" : "Ctrl N"}</Kbd>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Switch to Join</span>
                        <Kbd>{isMac ? "⌘J" : "Ctrl J"}</Kbd>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Open Guide</span>
                        <Kbd>{isMac ? "⌘/" : "Ctrl /"}</Kbd>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Close sidebar</span>
                        <Kbd>Esc</Kbd>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface-hover)]/45 p-4">
                    <div className="text-xs text-[var(--text-muted)]">
                      Pro tip: keep your mouse hand free — most navigation is faster with shortcuts.
                    </div>
                  </div>
                </div>
              )}
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Floating open button when sidebar closed */}
        {!rightOpen && (
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-30">
            <button
              onClick={() => openRight("guide")}
              className="px-3 py-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 backdrop-blur-xl hover:bg-[var(--surface-hover)]/70 shadow-sm text-xs font-medium flex items-center gap-2"
            >
              <span>Open</span>
              <Kbd>{isMac ? "⌘K" : "Ctrl K"}</Kbd>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
