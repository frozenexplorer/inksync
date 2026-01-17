"use client";

import { motion } from "framer-motion";
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
  const {
    tool,
    penColor,
    penThickness,
    role,
    setTool,
    setPenColor,
    setPenThickness,
  } = useWhiteboardStore();

  const handleClearBoard = () => {
    if (role !== "host") return;
    if (confirm("Are you sure you want to clear the board? This cannot be undone.")) {
      getSocket().emit("board:clear");
    }
  };

  const tools: { id: Tool; icon: JSX.Element; label: string }[] = [
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
    </motion.div>
  );
}
