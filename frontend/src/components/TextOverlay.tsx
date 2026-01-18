"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { DEFAULT_TEXT_FONT_FAMILY } from "@/lib/typography";
import { Point } from "@/lib/types";

interface TextOverlayProps {
  position: Point;
  onSubmit: (content: string) => void;
  onCancel: () => void;
  fontSize: number;
  color?: string;
  fontFamily?: string;
}

export function TextOverlay({ position, onSubmit, onCancel, fontSize, fontFamily }: TextOverlayProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isSubmitting = useRef(false);
  const resolvedFontFamily = fontFamily ?? DEFAULT_TEXT_FONT_FAMILY;

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
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="absolute z-[100]"
      style={{ left: position.x, top: position.y - fontSize / 2 }}
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
        className="bg-white backdrop-blur-sm outline-none border-2 border-[var(--primary)] rounded px-2 py-1 min-w-[150px] shadow-lg text-black"
        style={{ 
          fontSize: `${fontSize}px`, 
          fontFamily: resolvedFontFamily
        }}
      />
      <div className="text-[10px] text-[var(--text-muted)] mt-1">
        Press Enter to confirm, Esc to cancel
      </div>
    </motion.div>
  );
}
