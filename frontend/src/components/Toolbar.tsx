"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWhiteboardStore } from "@/store/whiteboard";
import { getSocket } from "@/lib/socket";
import { Tool } from "@/lib/types";

const COLORS = [
  "#000000", "#FFFFFF", "#FF6B6B", "#4ECDC4", 
  "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD",
  "#F8B500", "#6C5CE7"
];

const THICKNESSES = [2, 4, 6, 10, 16];

export function Toolbar() {
  const [showSettings, setShowSettings] = useState(false);
  
  const {
    tool,
    penColor,
    penThickness,
    role,
    showCursorCount,
    setTool,
    setPenColor,
    setPenThickness,
    setShowCursorCount,
  } = useWhiteboardStore();

  const handleClearBoard = () => {
    if (role !== "host") return;
    if (confirm("Are you sure you want to clear the board? This cannot be undone.")) {
      getSocket().emit("board:clear");
    }
  };

  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    {
      id: "pen",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      ),
      label: "Pen",
    },
    {
      id: "eraser",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21M22 21H7M5 11l9 9" />
        </svg>
      ),
      label: "Eraser",
    },
    {
      id: "text",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
        </svg>
      ),
      label: "Text",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute left-4 top-1/2 -translate-y-1/2 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3 flex flex-col gap-3 shadow-xl"
    >
      {/* Tools */}
      <div className="flex flex-col gap-1">
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            className={`p-3 rounded-xl transition-all duration-150 ${
              tool === t.id
                ? "bg-[var(--primary)] text-black"
                : "hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-white"
            }`}
            title={t.label}
          >
            {t.icon}
          </button>
        ))}
      </div>

      <div className="w-full h-px bg-[var(--border)]" />

      {/* Colors */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] text-[var(--text-muted)] text-center uppercase tracking-wide">Color</span>
        <div className="grid grid-cols-2 gap-1">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setPenColor(color)}
              className={`w-6 h-6 rounded-lg transition-transform duration-150 hover:scale-110 ${
                penColor === color ? "ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--surface)]" : ""
              }`}
              style={{ 
                backgroundColor: color,
                border: color === "#FFFFFF" ? "1px solid var(--border)" : "none"
              }}
              title={color}
            />
          ))}
        </div>
      </div>

      <div className="w-full h-px bg-[var(--border)]" />

      {/* Thickness */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] text-[var(--text-muted)] text-center uppercase tracking-wide">Size</span>
        <div className="flex flex-col gap-1 items-center">
          {THICKNESSES.map((thickness) => (
            <button
              key={thickness}
              onClick={() => setPenThickness(thickness)}
              className={`w-full p-1.5 rounded-lg flex items-center justify-center transition-all duration-150 ${
                penThickness === thickness
                  ? "bg-[var(--primary)]/20"
                  : "hover:bg-[var(--surface-hover)]"
              }`}
              title={`${thickness}px`}
            >
              <div
                className="rounded-full bg-white"
                style={{ 
                  width: `${Math.min(thickness + 4, 20)}px`, 
                  height: `${Math.min(thickness + 4, 20)}px` 
                }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Clear Board (Host only) */}
      {role === "host" && (
        <>
          <div className="w-full h-px bg-[var(--border)]" />
          <button
            onClick={handleClearBoard}
            className="p-3 rounded-xl text-red-400 hover:bg-red-500/20 transition-colors"
            title="Clear Board (Host only)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </>
      )}

      <div className="w-full h-px bg-[var(--border)]" />

      {/* Settings */}
      <div className="relative">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-3 rounded-xl transition-all duration-150 ${
            showSettings
              ? "bg-[var(--primary)] text-black"
              : "hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-white"
          }`}
          title="Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, x: -10, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute left-full ml-3 top-0 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xl min-w-[200px]"
            >
              <h3 className="text-sm font-semibold mb-3 text-white">Settings</h3>
              
              {/* Show Cursor Count Toggle */}
              <label className="flex items-center justify-between gap-3 cursor-pointer group">
                <span className="text-sm text-[var(--text-muted)] group-hover:text-white transition-colors">
                  Show cursor count
                </span>
                <button
                  onClick={() => setShowCursorCount(!showCursorCount)}
                  className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${
                    showCursorCount ? "bg-[var(--primary)]" : "bg-[var(--surface-hover)]"
                  }`}
                >
                  <motion.div
                    initial={false}
                    animate={{ x: showCursorCount ? 16 : 2 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                  />
                </button>
              </label>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
