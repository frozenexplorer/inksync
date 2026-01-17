"use client";

import { useEffect, useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useWhiteboardStore } from "@/store/whiteboard";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import { Canvas } from "@/components/Canvas";
import { Toolbar } from "@/components/Toolbar";
import { PresenceBar } from "@/components/PresenceBar";
import { ShareModal } from "@/components/ShareModal";
import { JoinPromptModal } from "@/components/JoinPromptModal";
import { RoomStatePayload, Stroke, TextItem, User, CursorPosition } from "@/lib/types";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const [showShareModal, setShowShareModal] = useState(false);
  const [showJoinPrompt, setShowJoinPrompt] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  const {
    isConnected,
    userName,
    setConnected,
    setRoomId,
    setUserInfo,
    setUserName,
    hydrateState,
    addStroke,
    removeStrokes,
    addText,
    clearBoard,
    addUser,
    removeUser,
    setHostChanged,
    updateRemoteCursor,
    removeRemoteCursor,
    reset,
  } = useWhiteboardStore();

  const setupSocketListeners = useCallback(() => {
    const socket = getSocket();

    socket.on("connect", () => {
      setConnected(true);
      
      // Get username from sessionStorage
      const storedName = sessionStorage.getItem("userName") || "Anonymous";
      setUserName(storedName);
      
      // Join the room
      socket.emit("room:join", { roomId, userName: storedName });
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("room:state", (payload: RoomStatePayload) => {
      setUserInfo(payload.userId, payload.role, payload.userColor);
      hydrateState(payload.state);
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

    socket.on("board:cleared", () => {
      clearBoard();
    });

    socket.on("user:joined", (user: User) => {
      addUser(user);
    });

    socket.on("user:left", (userId: string) => {
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
    setConnected,
    setUserName,
    setUserInfo,
    hydrateState,
    addStroke,
    removeStrokes,
    addText,
    clearBoard,
    addUser,
    removeUser,
    setHostChanged,
    updateRemoteCursor,
    removeRemoteCursor,
  ]);

  useEffect(() => {
    // Check if user has a name
    const storedName = sessionStorage.getItem("userName");
    if (!storedName) {
      // Show join prompt instead of redirecting
      setShowJoinPrompt(true);
      return;
    }

    setRoomId(roomId);
    setupSocketListeners();
    connectSocket();
    setIsReady(true);

    return () => {
      disconnectSocket();
      reset();
    };
  }, [roomId, setRoomId, setupSocketListeners, reset]);

  const handleJoinWithName = (name: string) => {
    sessionStorage.setItem("userName", name);
    setUserName(name);
    setShowJoinPrompt(false);
    setRoomId(roomId);
    setupSocketListeners();
    connectSocket();
    setIsReady(true);
  };

  const handleCancelJoin = () => {
    router.push("/");
  };

  const handleLeaveRoom = () => {
    disconnectSocket();
    reset();
    router.push("/");
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

  // Don't render until ready
  if (!isReady) {
    return (
      <div className="h-screen w-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-[var(--text-muted)]">Loading...</div>
      </div>
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

          {/* Share button */}
          <button
            onClick={() => setShowShareModal(true)}
            className="px-3 py-1.5 text-sm bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-medium rounded-lg transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span className="hidden sm:inline">Share</span>
          </button>

          {/* User name */}
          <div className="hidden md:flex items-center gap-2 text-sm text-[var(--text-muted)] border-l border-[var(--border)] pl-3">
            <span>{userName}</span>
          </div>

          {/* Leave button */}
          <button
            onClick={handleLeaveRoom}
            className="px-3 py-1.5 text-sm bg-[var(--surface-hover)] hover:bg-red-500/20 hover:text-red-400 border border-[var(--border)] rounded-lg transition-colors"
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

      {/* Share Modal */}
      <ShareModal 
        isOpen={showShareModal} 
        onClose={() => setShowShareModal(false)} 
        roomId={roomId} 
      />
    </div>
  );
}
