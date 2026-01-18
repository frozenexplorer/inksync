"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useWhiteboardStore } from "@/store/whiteboard";
import { getSocket } from "@/lib/socket";
import { nanoid } from "nanoid";
import { Point, Stroke, TextItem } from "@/lib/types";
import { clampTextSize, DEFAULT_TEXT_FONT_FAMILY, TEXT_SIZE_RANGE } from "@/lib/typography";
import { TextOverlay } from "./TextOverlay";
import { CursorTooltips } from "./CursorTooltips";

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [eraserCursor, setEraserCursor] = useState<Point | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<Point | null>(null);
  const lastCursorEmit = useRef(0);
  
  const {
    strokes,
    texts,
    currentStroke,
    tool,
    penColor,
    fontSize,
    fontFamily,
    userId,
    textInputPosition,
    eraserMode,
    eraserSize,
    startStroke,
    extendStroke,
    finishStroke,
    setTextInputPosition,
    removeStrokes,
    addStroke,
    addText,
    updateText,
    removeText,
  } = useWhiteboardStore();

  // Resize handler using ResizeObserver for reliable dimension updates
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width: Math.floor(width), height: Math.floor(height) });
        }
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Helper functions for drawing (defined before use)
  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke | { id: string; points: Point[]; color: string; thickness: number; authorId: string }) => {
    if (stroke.points.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.thickness;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    
    ctx.stroke();
  }, []);

  const drawText = useCallback((ctx: CanvasRenderingContext2D, text: TextItem) => {
    const resolvedFontFamily = text.fontFamily || DEFAULT_TEXT_FONT_FAMILY;
    ctx.font = `${text.fontSize}px ${resolvedFontFamily}`;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = text.color;
    ctx.fillText(text.content, text.position.x, text.position.y);
  }, []);

  // Draw all strokes and texts
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    
    // Don't draw if dimensions aren't set yet
    if (canvas.width === 0 || canvas.height === 0) return;

    // Clear canvas with white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all finalized strokes
    Object.values(strokes).forEach((stroke) => {
      drawStroke(ctx, stroke);
    });

    // Draw current stroke (being drawn)
    if (currentStroke && currentStroke.points.length > 0) {
      drawStroke(ctx, {
        ...currentStroke,
        id: currentStroke.id,
        authorId: userId || "",
      });
    }

    // Draw all texts
    Object.values(texts).forEach((text) => {
      drawText(ctx, text);
    });
  }, [strokes, texts, currentStroke, userId, drawStroke, drawText]);

  // Redraw on state changes and dimension changes
  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0) {
      requestAnimationFrame(draw);
    }
  }, [draw, dimensions]);

  useEffect(() => {
    if (tool !== "text") {
      setSelectedTextId(null);
    }
  }, [tool]);

  useEffect(() => {
    if (selectedTextId && !texts[selectedTextId]) {
      setSelectedTextId(null);
    }
  }, [selectedTextId, texts]);

  const getTextBounds = useCallback((ctx: CanvasRenderingContext2D, text: TextItem) => {
    const resolvedFontFamily = text.fontFamily || DEFAULT_TEXT_FONT_FAMILY;
    ctx.font = `${text.fontSize}px ${resolvedFontFamily}`;
    ctx.textBaseline = "alphabetic";
    const metrics = ctx.measureText(text.content);
    const ascent = metrics.actualBoundingBoxAscent || text.fontSize;
    const descent = metrics.actualBoundingBoxDescent || Math.max(2, text.fontSize * 0.2);
    return {
      x: text.position.x,
      y: text.position.y - ascent,
      width: metrics.width,
      height: ascent + descent,
    };
  }, []);

  const findTextAtPoint = useCallback((point: Point) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return null;

    const padding = 6;
    const textList = Object.values(texts);
    for (let i = textList.length - 1; i >= 0; i -= 1) {
      const text = textList[i];
      const bounds = getTextBounds(ctx, text);
      if (
        point.x >= bounds.x - padding &&
        point.x <= bounds.x + bounds.width + padding &&
        point.y >= bounds.y - padding &&
        point.y <= bounds.y + bounds.height + padding
      ) {
        return text.id;
      }
    }

    return null;
  }, [getTextBounds, texts]);

  const getPointerPosition = (e: React.PointerEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Emit cursor position (throttled to ~30fps)
  const emitCursorPosition = useCallback((point: Point, isActive: boolean) => {
    const now = Date.now();
    if (now - lastCursorEmit.current < 33) return; // Throttle to ~30fps
    lastCursorEmit.current = now;
    
    const socket = getSocket();
    if (socket.connected) {
      socket.emit("cursor:move", { position: point, isActive });
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Don't handle if text input is already open
    if (textInputPosition) return;
    
    const point = getPointerPosition(e);

    if (tool === "pen") {
      isDrawing.current = true;
      lastPoint.current = point;
      const strokeId = nanoid();
      startStroke(strokeId, point);
      emitCursorPosition(point, true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else if (tool === "eraser") {
      isDrawing.current = true;
      handleErase(point);
      emitCursorPosition(point, true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else if (tool === "text") {
      // Don't capture pointer for text tool - let the input handle it
      e.preventDefault();
      const hitTextId = findTextAtPoint(point);
      if (hitTextId) {
        setSelectedTextId(hitTextId);
        setTextInputPosition(null);
        return;
      }

      setSelectedTextId(null);
      setTextInputPosition(point);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const point = getPointerPosition(e);
    
    // Update eraser cursor position for visual indicator
    if (tool === "eraser") {
      setEraserCursor(point);
    }
    
    if (!isDrawing.current) return;

    if (tool === "pen") {
      extendStroke(point);
      lastPoint.current = point;
      emitCursorPosition(point, true);
    } else if (tool === "eraser") {
      handleErase(point);
      emitCursorPosition(point, true);
    }
  };
  
  const handlePointerLeaveCanvas = (e: React.PointerEvent) => {
    setEraserCursor(null);
    if (isDrawing.current) {
      const point = getPointerPosition(e);
      isDrawing.current = false;
      lastPoint.current = null;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      emitCursorPosition(point, false);

      if (tool === "pen") {
        const stroke = finishStroke();
        if (stroke && stroke.points.length > 1 && userId) {
          const fullStroke: Stroke = {
            ...stroke,
            authorId: userId,
          };
          // Add locally first (server won't broadcast back to sender)
          addStroke(fullStroke);
          getSocket().emit("stroke:add", fullStroke);
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawing.current) return;
    
    const point = getPointerPosition(e);
    isDrawing.current = false;
    lastPoint.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    // Emit that drawing stopped
    emitCursorPosition(point, false);

    if (tool === "pen") {
      const stroke = finishStroke();
      if (stroke && stroke.points.length > 1 && userId) {
        const fullStroke: Stroke = {
          ...stroke,
          authorId: userId,
        };
        // Add locally first (server won't broadcast back to sender)
        addStroke(fullStroke);
        getSocket().emit("stroke:add", fullStroke);
      }
    }
  };

  const handleErase = (point: Point) => {
    if (eraserMode === "stroke") {
      // Stroke eraser - delete entire strokes
      const strokesToErase: string[] = [];

      Object.values(strokes).forEach((stroke) => {
        for (const p of stroke.points) {
          const distance = Math.sqrt(
            Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2)
          );
          if (distance < eraserSize) {
            strokesToErase.push(stroke.id);
            break;
          }
        }
      });

      if (strokesToErase.length > 0) {
        removeStrokes(strokesToErase);
        getSocket().emit("erase:strokes", strokesToErase);
      }
    } else {
      // Pixel eraser - erase parts of strokes
      Object.values(strokes).forEach((stroke) => {
        const newSegments: Point[][] = [];
        let currentSegment: Point[] = [];

        stroke.points.forEach((p) => {
          const distance = Math.sqrt(
            Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2)
          );

          if (distance >= eraserSize) {
            // Point is outside eraser, keep it
            currentSegment.push(p);
          } else {
            // Point is inside eraser, start a new segment
            if (currentSegment.length >= 2) {
              newSegments.push([...currentSegment]);
            }
            currentSegment = [];
          }
        });

        // Don't forget the last segment
        if (currentSegment.length >= 2) {
          newSegments.push(currentSegment);
        }

        // If stroke was modified
        if (newSegments.length === 0) {
          // Entire stroke erased
          removeStrokes([stroke.id]);
          getSocket().emit("erase:strokes", [stroke.id]);
        } else if (newSegments.length === 1 && newSegments[0].length === stroke.points.length) {
          // No change
        } else {
          // Stroke was split or partially erased
          // Remove original stroke
          removeStrokes([stroke.id]);
          getSocket().emit("erase:strokes", [stroke.id]);

          // Add new strokes for each segment
          newSegments.forEach((segment) => {
            if (segment.length >= 2) {
              const newStroke: Stroke = {
                id: nanoid(),
                points: segment,
                color: stroke.color,
                thickness: stroke.thickness,
                authorId: stroke.authorId,
              };
              addStroke(newStroke);
              getSocket().emit("stroke:add", newStroke);
            }
          });
        }
      });
    }
  };

  const handleTextSubmit = (content: string) => {
    if (!textInputPosition || !content.trim()) {
      setTextInputPosition(null);
      return;
    }

    const text: TextItem = {
      id: nanoid(),
      position: textInputPosition,
      content: content.trim(),
      fontSize,
      fontFamily: fontFamily || DEFAULT_TEXT_FONT_FAMILY,
      color: penColor,
      authorId: userId || "anonymous",
    };

    // Add locally first for immediate feedback
    addText(text);
    
    // Then sync to server
    const socket = getSocket();
    if (socket.connected) {
      socket.emit("text:add", text);
    }
    
    setTextInputPosition(null);
  };

  const selectedText = selectedTextId ? texts[selectedTextId] : null;
  const selectedTextBounds = useMemo(() => {
    if (!selectedText) return null;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return null;
    return getTextBounds(ctx, selectedText);
  }, [selectedText, getTextBounds, dimensions]);

  const selectionPadding = 6;
  const selectionBox = selectedTextBounds
    ? {
        left: selectedTextBounds.x - selectionPadding,
        top: selectedTextBounds.y - selectionPadding,
        width: selectedTextBounds.width + selectionPadding * 2,
        height: selectedTextBounds.height + selectionPadding * 2,
      }
    : null;

  const selectionControlWidth = 180;
  const selectionControlLeft = selectionBox
    ? Math.min(
        Math.max(8, selectionBox.left),
        Math.max(8, dimensions.width - selectionControlWidth - 8)
      )
    : 0;
  const selectionControlTop = selectionBox ? Math.max(8, selectionBox.top - 44) : 0;

  const handleSelectedTextSizeChange = (nextSize: number) => {
    if (!selectedText) return;
    const clampedSize = clampTextSize(nextSize);
    if (clampedSize === selectedText.fontSize) return;

    const updatedText: TextItem = {
      ...selectedText,
      fontSize: clampedSize,
      fontFamily: selectedText.fontFamily || DEFAULT_TEXT_FONT_FAMILY,
    };
    updateText(updatedText);

    const socket = getSocket();
    if (socket.connected) {
      socket.emit("text:update", updatedText);
    }
  };

  const handleDeleteSelectedText = () => {
    if (!selectedText) return;
    removeText(selectedText.id);
    setSelectedTextId(null);

    const socket = getSocket();
    if (socket.connected) {
      socket.emit("text:remove", selectedText.id);
    }
  };

  const getCursorClass = () => {
    switch (tool) {
      case "pen":
        return "cursor-pen";
      case "eraser":
        return "cursor-none"; // Hide default cursor, we'll show custom one
      case "text":
        return "cursor-text";
      default:
        return "";
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className={`w-full h-full touch-none bg-white ${getCursorClass()}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeaveCanvas}
      />

      {tool === "text" && selectedText && selectionBox && (
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute rounded-md border border-(--primary)"
            style={{
              left: selectionBox.left,
              top: selectionBox.top,
              width: selectionBox.width,
              height: selectionBox.height,
            }}
          />
          <AnimatePresence>
            <motion.div
              key={selectedText.id}
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-auto absolute flex items-center gap-3 rounded-lg bg-(--surface) border border-(--border) px-2 py-1.5 shadow-xl"
              style={{ left: selectionControlLeft, top: selectionControlTop }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-(--text-muted) uppercase tracking-wide">Size</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-(--text-muted)">{selectedText.fontSize}px</span>
                  <input
                    type="range"
                    min={TEXT_SIZE_RANGE.min}
                    max={TEXT_SIZE_RANGE.max}
                    step={TEXT_SIZE_RANGE.step}
                    value={selectedText.fontSize}
                    onChange={(e) => handleSelectedTextSizeChange(Number(e.target.value))}
                    className="w-24 h-1.5 bg-(--surface-hover) rounded-full appearance-none cursor-pointer accent-(--primary)"
                  />
                </div>
              </div>
              <button
                onClick={handleDeleteSelectedText}
                className="p-1.5 rounded-md text-red-400 hover:bg-red-500/20 transition-colors"
                title="Delete text"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </motion.div>
          </AnimatePresence>
        </div>
      )}
      
      {/* Eraser cursor indicator */}
      {tool === "eraser" && eraserCursor && (
        <div
          className="pointer-events-none absolute rounded-full border-2 transition-all duration-75"
          style={{
            left: eraserCursor.x - eraserSize,
            top: eraserCursor.y - eraserSize,
            width: eraserSize * 2,
            height: eraserSize * 2,
            borderColor: eraserMode === "stroke" ? "#ef4444" : "#f59e0b",
            backgroundColor: eraserMode === "stroke" ? "rgba(239, 68, 68, 0.1)" : "rgba(245, 158, 11, 0.1)",
          }}
        />
      )}
      
      {/* Remote cursor tooltips */}
      <CursorTooltips />
      
      {/* Text input overlay */}
      <AnimatePresence>
        {textInputPosition && (
          <TextOverlay
            key="text-overlay"
            position={textInputPosition}
            onSubmit={handleTextSubmit}
            onCancel={() => setTextInputPosition(null)}
            fontSize={fontSize}
            color={penColor}
            fontFamily={fontFamily}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
