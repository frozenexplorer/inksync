"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useWhiteboardStore } from "@/store/whiteboard";
import { getSocket } from "@/lib/socket";
import { nanoid } from "nanoid";
import { Point, Stroke, TextItem } from "@/lib/types";
import { TextOverlay } from "./TextOverlay";
import { CursorTooltips } from "./CursorTooltips";

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [eraserCursor, setEraserCursor] = useState<Point | null>(null);
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
    userId,
    textInputPosition,
    eraserMode,
    eraserSize,
    startStroke,
    extendStroke,
    finishStroke,
    setTextInputPosition,
    removeStrokes,
    updateStroke,
    addStroke,
  } = useWhiteboardStore();

  // Resize handler
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
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
    ctx.font = `${text.fontSize}px 'Outfit', sans-serif`;
    ctx.fillStyle = text.color;
    ctx.fillText(text.content, text.position.x, text.position.y);
  }, []);

  // Draw all strokes and texts
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

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

  // Redraw on state changes
  useEffect(() => {
    requestAnimationFrame(draw);
  }, [draw]);

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
    if (!textInputPosition || !userId || !content.trim()) {
      setTextInputPosition(null);
      return;
    }

    const text: TextItem = {
      id: nanoid(),
      position: textInputPosition,
      content: content.trim(),
      fontSize,
      color: penColor,
      authorId: userId,
    };

    getSocket().emit("text:add", text);
    setTextInputPosition(null);
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
        className={`w-full h-full touch-none ${getCursorClass()}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeaveCanvas}
      />
      
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
      
      {textInputPosition && (
        <TextOverlay
          position={textInputPosition}
          onSubmit={handleTextSubmit}
          onCancel={() => setTextInputPosition(null)}
          fontSize={fontSize}
          color={penColor}
        />
      )}
    </div>
  );
}
