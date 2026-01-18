"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useWhiteboardStore } from "@/store/whiteboard";
import { Point } from "@/lib/types";

interface CursorTooltipsProps {
  offset: Point;
  zoom: number;
}

export function CursorTooltips({ offset, zoom }: CursorTooltipsProps) {
  const { remoteCursors, userId, showCursorCount } = useWhiteboardStore();
  
  // Filter out own cursor
  const cursors = Object.values(remoteCursors).filter(c => c.userId !== userId);

  return (
    <div className="pointer-events-none absolute inset-0 z-50">
      {/* Cursor count indicator */}
      <AnimatePresence>
        {showCursorCount && cursors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.2 }}
            className="absolute top-4 left-4 flex items-center gap-2 bg-(--surface)/90 backdrop-blur-sm border border-(--border) px-3 py-2 rounded-full shadow-lg"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-(--primary) opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-(--primary)" />
            </span>
            <span className="text-xs font-medium text-white">
              {cursors.length} {cursors.length === 1 ? "person" : "people"} drawing
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {cursors.map((cursor) => (
          <motion.div
            key={cursor.userId}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ 
              opacity: 0, 
              scale: 0.8, 
              transition: { duration: 0.3 }
            }}
            transition={{
              opacity: { duration: 0.2 },
              scale: { duration: 0.2 },
            }}
            className="absolute"
            style={{ 
              left: cursor.position.x * zoom + offset.x,
              top: cursor.position.y * zoom + offset.y,
              willChange: "left, top, opacity"
            }}
          >
            {/* Cursor pointer */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="drop-shadow-lg"
              style={{ filter: `drop-shadow(0 2px 4px ${cursor.userColor}40)` }}
            >
              <path
                d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L6.35 2.85a.5.5 0 0 0-.85.36Z"
                fill={cursor.userColor}
                stroke="white"
                strokeWidth="1.5"
              />
            </svg>
            
            {/* Name tooltip with blur fade */}
            <motion.div
              initial={{ opacity: 0, y: 5, filter: "blur(4px)" }}
              animate={{ 
                opacity: cursor.isActive ? 1 : 0.7, 
                y: 0, 
                filter: "blur(0px)",
                scale: cursor.isActive ? 1.05 : 1,
              }}
              exit={{
                opacity: 0,
                filter: "blur(4px)",
                transition: { duration: 0.2 }
              }}
              transition={{ duration: 0.2 }}
              className="absolute left-5 top-5 whitespace-nowrap"
            >
              <div
                className="px-2.5 py-1 rounded-full text-xs font-medium shadow-lg backdrop-blur-sm border"
                style={{
                  backgroundColor: `${cursor.userColor}e6`,
                  borderColor: `${cursor.userColor}`,
                  color: getContrastColor(cursor.userColor),
                  boxShadow: `0 4px 12px ${cursor.userColor}30`,
                }}
              >
                <span className="flex items-center gap-1.5">
                  {cursor.isActive && (
                    <span className="relative flex h-2 w-2">
                      <span 
                        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                        style={{ backgroundColor: getContrastColor(cursor.userColor) }}
                      />
                      <span 
                        className="relative inline-flex rounded-full h-2 w-2"
                        style={{ backgroundColor: getContrastColor(cursor.userColor) }}
                      />
                    </span>
                  )}
                  {cursor.userName}
                </span>
              </div>
            </motion.div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Helper to get contrasting text color
function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#1a1a1a" : "#ffffff";
}
