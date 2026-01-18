"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Point } from "@/lib/types";

interface TextOverlayProps {
  position: Point;
  onSubmit: (content: string) => void;
  onCancel: () => void;
  fontSize: number;
  color?: string;
  containerWidth?: number;
  containerHeight?: number;
}

const INPUT_MIN_WIDTH = 200;
const INPUT_HEIGHT = 70; // Approximate height including hint text
const EDGE_MARGIN = 16;

export function TextOverlay({ position, onSubmit, onCancel, fontSize, containerWidth, containerHeight }: TextOverlayProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isSubmitting = useRef(false);

  // Calculate adjusted position based on container bounds
  const { left, top, openLeft, openUp } = useMemo(() => {
    const canvasWidth = containerWidth ?? 0;
    const canvasHeight = containerHeight ?? 0;
    
    // Determine if we need to open to the left (click is near right edge)
    const openLeft = canvasWidth > 0 && position.x + INPUT_MIN_WIDTH > canvasWidth - EDGE_MARGIN;
    
    // Determine if we need to open upward (click is near bottom edge)
    const openUp = canvasHeight > 0 && position.y + INPUT_HEIGHT > canvasHeight - EDGE_MARGIN;
    
    // Calculate actual position
    let left = position.x;
    let top = position.y;
    
    if (openLeft) {
      // Position so right edge is at click point
      left = Math.max(EDGE_MARGIN, position.x - INPUT_MIN_WIDTH);
    }
    
    if (openUp) {
      // Position so bottom edge is at click point
      top = Math.max(EDGE_MARGIN, position.y - INPUT_HEIGHT);
    }

    return { left, top, openLeft, openUp };
  }, [position, containerWidth, containerHeight]);

  useEffect(() => {
    // Focus with a small delay to ensure the element is fully rendered
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = () => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    onSubmit(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  const handleBlur = () => {
    // Only submit on blur if there's text, otherwise cancel
    setTimeout(() => {
      if (!isSubmitting.current) {
        if (text.trim()) {
          handleSubmit();
        } else {
          onCancel();
        }
      }
    }, 150);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.1 }}
      className="absolute z-50"
      style={{ 
        left,
        top,
        transformOrigin: `${openLeft ? "right" : "left"} ${openUp ? "bottom" : "top"}`,
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder="Type here..."
        className="bg-white backdrop-blur-sm outline-none border-2 border-(--primary) rounded px-2 py-1 min-w-[150px] max-w-[200px] shadow-lg text-black"
        style={{ 
          fontSize: `${fontSize}px`, 
          fontFamily: "'Outfit', sans-serif"
        }}
      />
      <div className={`text-[10px] text-(--text-muted) mt-1 ${openLeft ? "text-right" : ""}`}>
        Press Enter to confirm, Esc to cancel
      </div>
    </motion.div>
  );
}
