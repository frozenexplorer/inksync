"use client";

import React, { useRef, useState, useEffect } from "react";
import { StickyNote as StickyNoteType } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";

interface StickyNoteProps {
    sticky: StickyNoteType;
    zoom: number;
    panOffset: { x: number; y: number };
    isSelected: boolean;
    onUpdate: (sticky: StickyNoteType) => void;
    onDelete: (id: string) => void;
    onSelect: (id: string) => void;
}

export function StickyNote({
    sticky,
    zoom,
    panOffset,
    isSelected,
    onUpdate,
    onDelete,
    onSelect,
}: StickyNoteProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [content, setContent] = useState(sticky.content);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const dragStartRef = useRef<{ x: number; y: number; stickyX: number; stickyY: number } | null>(null);

    // Screen coordinates (after zoom and pan transformation)
    const screenX = sticky.position.x * zoom + panOffset.x;
    const screenY = sticky.position.y * zoom + panOffset.y;
    const screenWidth = sticky.width * zoom;
    const screenHeight = sticky.height * zoom;

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [isEditing]);

    // Sync local content state when sticky.content changes from socket updates
    useEffect(() => {
        if (!isEditing) {
            setContent(sticky.content);
        }
    }, [sticky.content, isEditing]);

    const handleDoubleClick = () => {
        setIsEditing(true);
    };

    const handleBlur = () => {
        setIsEditing(false);
        if (content !== sticky.content) {
            onUpdate({ ...sticky, content });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            setIsEditing(false);
            setContent(sticky.content); // Reset to original
        }
        // Don't close on Enter - allow multi-line
        e.stopPropagation(); // Prevent canvas shortcuts
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (isEditing) return;

        e.stopPropagation();
        onSelect(sticky.id);

        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            stickyX: sticky.position.x,
            stickyY: sticky.position.y,
        };
        setIsDragging(true);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging || !dragStartRef.current) return;

        const deltaX = (e.clientX - dragStartRef.current.x) / zoom;
        const deltaY = (e.clientY - dragStartRef.current.y) / zoom;

        const newX = dragStartRef.current.stickyX + deltaX;
        const newY = dragStartRef.current.stickyY + deltaY;

        onUpdate({
            ...sticky,
            position: { x: newX, y: newY },
        });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (isDragging) {
            setIsDragging(false);
            dragStartRef.current = null;
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        }
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(sticky.id);
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className={`absolute select-none ${isDragging ? "cursor-grabbing" : isEditing ? "cursor-text" : "cursor-grab"
                }`}
            style={{
                left: screenX,
                top: screenY,
                width: screenWidth,
                height: screenHeight,
                backgroundColor: sticky.color || "#ffebb3",
                boxShadow: isSelected
                    ? "0 8px 24px rgba(0,0,0,0.25), 0 0 0 2px var(--primary)"
                    : "0 6px 16px rgba(0,0,0,0.15)",
                border: "1px solid rgba(0,0,0,0.1)",
                borderRadius: 2,
                padding: screenWidth * 0.1,
                overflow: "hidden",
                zIndex: isSelected ? 50 : 40,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onDoubleClick={handleDoubleClick}
        >
            {/* Delete button - only show when selected */}
            <AnimatePresence>
                {isSelected && !isEditing && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={handleDeleteClick}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-md z-10"
                        style={{ fontSize: Math.max(12, screenWidth * 0.06) }}
                        title="Delete sticky note"
                    >
                        ×
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Content */}
            {isEditing ? (
                <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="w-full h-full bg-transparent border-none outline-none resize-none font-['Outfit'] text-[#1e1e1e] cursor-text"
                    style={{
                        fontSize: Math.max(12, screenWidth * 0.08),
                        lineHeight: 1.5,
                    }}
                />
            ) : (
                <div
                    className="w-full h-full overflow-hidden whitespace-pre-wrap break-words font-['Outfit'] text-[#1e1e1e] cursor-text"
                    style={{
                        fontSize: Math.max(12, screenWidth * 0.08),
                        lineHeight: 1.5,
                    }}
                >
                    {content || "Double-click to edit"}
                </div>
            )}
        </motion.div>
    );
}
