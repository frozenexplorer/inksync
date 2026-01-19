"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { UserButton, useUser } from "@clerk/nextjs";
import { useWhiteboardStore } from "@/store/whiteboard";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import { renderBoardToCanvas } from "@/lib/canvasExport";
import { Canvas } from "@/components/Canvas";
import { Toolbar } from "@/components/Toolbar";
import { PresenceBar } from "@/components/PresenceBar";
import { ChatPanel } from "@/components/ChatPanel";
import { ShareModal } from "@/components/ShareModal";
import { JoinPromptModal } from "@/components/JoinPromptModal";
import { ToastContainer, useToasts } from "@/components/Toast";
import { RoomStatePayload, Stroke, TextItem, User, CursorPosition, RoomErrorPayload, ChatMessage } from "@/lib/types";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, user } = useUser();
  const roomId = params.roomId as string;
  const isCreating = searchParams.get("create") === "true";
  const [showShareModal, setShowShareModal] = useState(false);
  const [showJoinPrompt, setShowJoinPrompt] = useState(() => {
    // Check on initial render if user has a name
    if (typeof window !== "undefined") {
      return !sessionStorage.getItem("userName");
    }
    return false;
  });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const { toasts, addToast, removeToast } = useToasts();
  const addToastRef = useRef(addToast);
  const hasInitialized = useRef(false);
  const isCreatingRef = useRef(isCreating);
  const isChatOpenRef = useRef(isChatOpen);
  const userIdRef = useRef<string | null>(null);
  const clerkUserIdRef = useRef<string | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  
  // Update ref in effect to avoid updating during render
  useEffect(() => {
    addToastRef.current = addToast;
  }, [addToast]);
  
  const {
    isConnected,
    userId,
    userName,
    messages,
    setConnected,
    setRoomId,
    setUserInfo,
    setUserName,
    hydrateState,
    addStroke,
    removeStrokes,
    addText,
    updateText,
    removeText,
    addMessage,
    clearBoard,
    addUser,
    removeUser,
    setHostChanged,
    updateRemoteCursor,
    removeRemoteCursor,
    reset,
  } = useWhiteboardStore();

  const addMessageRef = useRef(addMessage);

  useEffect(() => {
    addMessageRef.current = addMessage;
  }, [addMessage]);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    clerkUserIdRef.current = user?.id || null;
  }, [user?.id]);

  useEffect(() => {
    if (!isExportOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const menu = exportMenuRef.current;
      if (!menu) return;
      if (menu.contains(event.target as Node)) return;
      setIsExportOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExportOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExportOpen]);

  const setupSocketListeners = useCallback(() => {
    const socket = getSocket();

    // Remove existing listeners to prevent duplicates
    socket.off("connect");
    socket.off("disconnect");
    socket.off("room:state");
    socket.off("room:error");
    socket.off("stroke:added");
    socket.off("strokes:erased");
    socket.off("text:added");
    socket.off("text:updated");
    socket.off("text:removed");
    socket.off("chat:new");
    socket.off("board:cleared");
    socket.off("user:joined");
    socket.off("user:left");
    socket.off("host:changed");
    socket.off("cursor:update");

    socket.on("connect", () => {
      setConnected(true);
      
      // Get username from sessionStorage
      const storedName = sessionStorage.getItem("userName") || "Anonymous";
      setUserName(storedName);
      
      // Join the room - pass isCreating flag and Clerk user ID for persistence
      socket.emit("room:join", { 
        roomId, 
        userName: storedName, 
        isCreating: isCreatingRef.current,
        clerkUserId: clerkUserIdRef.current || undefined
      });
    });

    socket.on("room:error", (error: RoomErrorPayload) => {
      // Show error toast
      addToastRef.current({
        type: "error",
        message: error.message,
      });
      
      // Disconnect and redirect after a short delay
      setTimeout(() => {
        disconnectSocket();
        reset();
        router.push("/");
      }, 1500);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("room:state", (payload: RoomStatePayload) => {
      setUserInfo(payload.userId, payload.role, payload.userColor);
      hydrateState(payload.state);
      setHasUnread(false);
    });

    socket.on("stroke:added", (stroke: Stroke) => {
      addStroke(stroke);
    });

    socket.on("strokes:erased", (strokeIds: string[]) => {
      removeStrokes(strokeIds);
    });

    socket.on("text:added", (text: TextItem) => {
      addText(text);
    });

    socket.on("text:updated", (text: TextItem) => {
      updateText(text);
    });

    socket.on("text:removed", (textId: string) => {
      removeText(textId);
    });

    socket.on("chat:new", (message: ChatMessage) => {
      addMessageRef.current(message);
      if (!isChatOpenRef.current && message.userId !== userIdRef.current) {
        setHasUnread(true);
      }
    });

    socket.on("board:cleared", () => {
      clearBoard();
    });

    socket.on("user:joined", (user: User) => {
      addUser(user);
      // Show toast for other users joining
      addToastRef.current({
        type: "join",
        userName: user.name,
        userColor: user.color,
      });
    });

    socket.on("user:left", (userId: string) => {
      // Get user info before removing for the toast
      const users = useWhiteboardStore.getState().users;
      const leavingUser = users[userId];
      
      if (leavingUser) {
        addToastRef.current({
          type: "leave",
          userName: leavingUser.name,
          userColor: leavingUser.color,
        });
      }
      
      removeUser(userId);
      removeRemoteCursor(userId);
    });

    socket.on("host:changed", (newHostId: string) => {
      setHostChanged(newHostId);
    });

    // Cursor updates from other users
    socket.on("cursor:update", (cursorData: { userId: string; userName: string; userColor: string; position: { x: number; y: number }; isActive: boolean }) => {
      const cursor: CursorPosition = {
        ...cursorData,
        timestamp: Date.now(),
      };
      updateRemoteCursor(cursor);
    });
  }, [
    roomId,
    router,
    setConnected,
    setUserName,
    setUserInfo,
    hydrateState,
    addStroke,
    removeStrokes,
    addText,
    updateText,
    removeText,
    clearBoard,
    addUser,
    removeUser,
    setHostChanged,
    updateRemoteCursor,
    removeRemoteCursor,
    reset,
  ]);

  useEffect(() => {
    // Skip setup if showing join prompt or already initialized
    if (showJoinPrompt || hasInitialized.current) return;

    hasInitialized.current = true;
    setRoomId(roomId);
    setupSocketListeners();
    connectSocket();

    return () => {
      disconnectSocket();
      reset();
      hasInitialized.current = false;
    };
  }, [roomId, setRoomId, setupSocketListeners, reset, showJoinPrompt]);

  const handleJoinWithName = (name: string) => {
    sessionStorage.setItem("userName", name);
    setUserName(name);
    setShowJoinPrompt(false);
    hasInitialized.current = true;
    setRoomId(roomId);
    setupSocketListeners();
    connectSocket();
  };

  const handleCancelJoin = () => {
    router.push("/");
  };

  const handleLeaveRoom = () => {
    disconnectSocket();
    reset();
    router.push("/");
  };

  const handleToggleChat = () => {
    setIsChatOpen((prev) => {
      const next = !prev;
      if (next) {
        setHasUnread(false);
      }
      return next;
    });
  };

  const getExportCanvas = useCallback(() => {
    const { strokes, texts } = useWhiteboardStore.getState();
    const exportResult = renderBoardToCanvas({ strokes, texts });
    if (!exportResult) {
      addToastRef.current({
        type: "error",
        message: "Nothing to export yet.",
      });
      return null;
    }
    return exportResult;
  }, []);

  const handleExportPdf = useCallback(async () => {
    setIsExportOpen(false);
    const exportResult = getExportCanvas();
    if (!exportResult) return;

    try {
      const { jsPDF } = await import("jspdf");
      const { canvas, width, height } = exportResult;
      const pdf = new jsPDF({
        orientation: width >= height ? "l" : "p",
        unit: "px",
        format: [width, height],
        compress: true,
      });
      const imageData = canvas.toDataURL("image/png");
      pdf.addImage(imageData, "PNG", 0, 0, width, height);
      pdf.save(`inksync-board-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      addToastRef.current({
        type: "error",
        message: "Failed to export PDF.",
      });
    }
  }, [getExportCanvas]);

  const handleExportPng = useCallback(() => {
    setIsExportOpen(false);
    const exportResult = getExportCanvas();
    if (!exportResult) return;

    const { canvas } = exportResult;
    const imageData = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = imageData;
    link.download = `inksync-board-${new Date().toISOString().slice(0, 10)}.png`;
    link.click();
  }, [getExportCanvas]);

  const handleSendChat = (content: string) => {
    const socket = getSocket();
    if (!socket.connected) return;
    socket.emit("chat:send", { content });
  };

  // Show join prompt if user doesn't have a name
  if (showJoinPrompt) {
    return (
      <JoinPromptModal 
        roomId={roomId} 
        onJoin={handleJoinWithName} 
        onCancel={handleCancelJoin} 
      />
    );
  }


  return (
    <div className="h-screen w-screen overflow-hidden bg-[var(--background)] flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="h-14 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between px-4 flex-shrink-0"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <div>
            <h1 className="font-semibold text-sm">InkSync</h1>
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span>Room: {roomId}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} ${isConnected ? '' : 'animate-pulse-slow'}`} />
            <span className="text-[var(--text-muted)] text-xs hidden sm:inline">
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>

          {/* Presence */}
          <PresenceBar />

          {/* Chat toggle */}
          <button
            onClick={handleToggleChat}
            aria-label={isChatOpen ? "Close chat" : "Open chat"}
            aria-pressed={isChatOpen}
            title="Chat"
            className={`relative w-9 h-9 rounded-lg border border-[var(--border)] flex items-center justify-center transition-colors cursor-pointer ${
              isChatOpen
                ? "bg-[var(--primary)] text-black"
                : "bg-[var(--surface-hover)] hover:bg-[var(--primary)] hover:text-black"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h8M8 14h4m-6 6h8a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12l4-4z"
              />
            </svg>
            {hasUnread && !isChatOpen && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--secondary)] ring-2 ring-[var(--surface)]" />
            )}
          </button>

          {/* Export menu */}
          <div ref={exportMenuRef} className="relative">
            <button
              onClick={() => setIsExportOpen((prev) => !prev)}
              aria-label="Export options"
              aria-haspopup="menu"
              aria-expanded={isExportOpen}
              title="Export"
              className={`relative w-9 h-9 rounded-lg border border-[var(--border)] flex items-center justify-center transition-colors cursor-pointer ${
                isExportOpen
                  ? "bg-[var(--primary)] text-black"
                  : "bg-[var(--surface-hover)] hover:bg-[var(--primary)] hover:text-black"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v10m0 0l4-4m-4 4l-4-4M4 17v3h16v-3"
                />
              </svg>
            </button>

            {isExportOpen && (
              <div className="absolute right-0 top-full mt-2 w-40 rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 p-2 shadow-xl backdrop-blur z-40">
                <button
                  onClick={handleExportPng}
                  aria-label="Export as PNG"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16v12H4z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 14l3-3 4 4 3-3 3 4" />
                  </svg>
                  <span>Export PNG</span>
                </button>
                <button
                  onClick={handleExportPdf}
                  aria-label="Export as PDF"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 6h6l4 4v8a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 12h4m-4 3h4" />
                  </svg>
                  <span>Export PDF</span>
                </button>
              </div>
            )}
          </div>

          {/* Share button */}
          <button
            onClick={() => setShowShareModal(true)}
            className="px-3 py-1.5 text-sm bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span className="hidden sm:inline">Share</span>
          </button>

          {/* User info */}
          <div className="hidden md:flex items-center gap-2 text-sm text-[var(--text-muted)] border-l border-[var(--border)] pl-3">
            {isSignedIn ? (
              <UserButton />
            ) : (
              <span>{userName}</span>
            )}
          </div>

          {/* Leave button */}
          <button
            onClick={handleLeaveRoom}
            className="px-3 py-1.5 text-sm bg-[var(--surface-hover)] hover:bg-red-500/20 hover:text-red-400 border border-[var(--border)] rounded-lg transition-colors cursor-pointer"
          >
            Leave
          </button>
        </div>
      </motion.header>

      {/* Main canvas area */}
      <div className="flex-1 relative overflow-hidden">
        <Canvas />
        <Toolbar />
      </div>

      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onSend={handleSendChat}
        messages={messages}
        userId={userId}
      />

      {/* Share Modal */}
      <ShareModal 
        isOpen={showShareModal} 
        onClose={() => setShowShareModal(false)} 
        roomId={roomId} 
      />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
