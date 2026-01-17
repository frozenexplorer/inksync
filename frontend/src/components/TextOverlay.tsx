"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Point } from "@/lib/types";

interface TextOverlayProps {
  position: Point;
  onSubmit: (content: string) => void;
  onCancel: () => void;
  fontSize: number;
  color: string;
}

export function TextOverlay({ position, onSubmit, onCancel, fontSize, color }: TextOverlayProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSubmit(text);
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="absolute"
      style={{ left: position.x, top: position.y - fontSize / 2 }}
    >
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onSubmit(text)}
        placeholder="Type here..."
        className="bg-transparent outline-none border-b-2 border-dashed border-[var(--primary)] min-w-[100px]"
        style={{ 
          fontSize: `${fontSize}px`, 
          color,
          fontFamily: "'Outfit', sans-serif"
        }}
      />
    </motion.div>
  );
}
