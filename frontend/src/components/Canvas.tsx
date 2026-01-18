"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { AnimatePresence } from "framer-motion";
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
  const eraseFrameRef = useRef<number | null>(null);
  const pendingErasePointRef = useRef<Point | null>(null);
  
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
    applyStrokeChanges,
    addStroke,
    addText,
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

  useEffect(() => {
    return () => {
      if (eraseFrameRef.current !== null) {
        cancelAnimationFrame(eraseFrameRef.current);
      }
    };
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

  const performErase = useCallback((point: Point) => {
    const strokeList = Object.values(strokes);
    if (strokeList.length === 0 || eraserSize <= 0) return;

    const radius = eraserSize / 2;
    const radiusSq = radius * radius;
    const socket = getSocket();

    if (eraserMode === "stroke") {
      const strokesToErase: string[] = [];

      for (const stroke of strokeList) {
        for (const p of stroke.points) {
          const dx = p.x - point.x;
          const dy = p.y - point.y;
          if (dx * dx + dy * dy < radiusSq) {
            strokesToErase.push(stroke.id);
            break;
          }
        }
      }

      if (strokesToErase.length > 0) {
        removeStrokes(strokesToErase);
        if (socket.connected) {
          socket.emit("erase:strokes", strokesToErase);
        }
      }
      return;
    }

    const epsilon = 1e-6;
    const isInside = (p: Point) => {
      const dx = p.x - point.x;
      const dy = p.y - point.y;
      return dx * dx + dy * dy <= radiusSq;
    };

    const addPointUnique = (segment: Point[], p: Point) => {
      const last = segment[segment.length - 1];
      if (!last || Math.abs(last.x - p.x) > epsilon || Math.abs(last.y - p.y) > epsilon) {
        segment.push(p);
      }
    };

    const removedIds: string[] = [];
    const newStrokes: Stroke[] = [];

    for (const stroke of strokeList) {
      const points = stroke.points;
      if (points.length < 2) continue;

      let currentSegment: Point[] = [];
      const segments: Point[][] = [];
      let didErase = false;

      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const inside1 = isInside(p1);
        const inside2 = isInside(p2);

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const a = dx * dx + dy * dy;

        let tValues: number[] = [];
        if (a > epsilon) {
          const fx = p1.x - point.x;
          const fy = p1.y - point.y;
          const b = 2 * (fx * dx + fy * dy);
          const c = fx * fx + fy * fy - radiusSq;
          const discriminant = b * b - 4 * a * c;

          if (discriminant > epsilon) {
            const sqrtDisc = Math.sqrt(discriminant);
            const t1 = (-b - sqrtDisc) / (2 * a);
            const t2 = (-b + sqrtDisc) / (2 * a);
            if (t1 > 0 && t1 < 1) tValues.push(t1);
            if (t2 > 0 && t2 < 1) tValues.push(t2);
          } else if (Math.abs(discriminant) <= epsilon) {
            const t = -b / (2 * a);
            if (t > 0 && t < 1 && inside1 !== inside2) {
              tValues.push(t);
            }
          }
        }

        if (tValues.length === 0) {
          if (!inside1 && !inside2) {
            if (currentSegment.length === 0) {
              addPointUnique(currentSegment, p1);
            }
            addPointUnique(currentSegment, p2);
          } else if (inside1 && inside2) {
            if (currentSegment.length >= 2) {
              segments.push(currentSegment);
            }
            currentSegment = [];
            didErase = true;
          } else {
            if (!inside1 && inside2) {
              if (currentSegment.length === 0) {
                addPointUnique(currentSegment, p1);
              }
              if (currentSegment.length >= 2) {
                segments.push(currentSegment);
              }
              currentSegment = [];
              didErase = true;
            } else if (inside1 && !inside2) {
              if (currentSegment.length >= 2) {
                segments.push(currentSegment);
              }
              currentSegment = [];
              didErase = true;
              addPointUnique(currentSegment, p2);
            }
          }
          continue;
        }

        tValues.sort((x, y) => x - y);
        if (tValues.length === 2 && Math.abs(tValues[0] - tValues[1]) <= epsilon) {
          tValues = [tValues[0]];
        }

        const ts = [0, ...tValues, 1];
        let segmentInside = inside1;

        for (let j = 0; j < ts.length - 1; j++) {
          const tStart = ts[j];
          const tEnd = ts[j + 1];

          if (segmentInside) {
            if (currentSegment.length >= 2) {
              segments.push(currentSegment);
            }
            currentSegment = [];
            didErase = true;
          } else {
            const startPoint = tStart === 0 ? p1 : {
              x: p1.x + dx * tStart,
              y: p1.y + dy * tStart,
            };
            const endPoint = tEnd === 1 ? p2 : {
              x: p1.x + dx * tEnd,
              y: p1.y + dy * tEnd,
            };
            if (currentSegment.length === 0) {
              addPointUnique(currentSegment, startPoint);
            } else {
              addPointUnique(currentSegment, startPoint);
            }
            addPointUnique(currentSegment, endPoint);
          }

          segmentInside = !segmentInside;
        }
      }

      if (currentSegment.length >= 2) {
        segments.push(currentSegment);
      }

      if (!didErase) {
        continue;
      }

      removedIds.push(stroke.id);

      for (const segment of segments) {
        if (segment.length < 2) continue;
        newStrokes.push({
          id: nanoid(),
          points: segment,
          color: stroke.color,
          thickness: stroke.thickness,
          authorId: stroke.authorId,
        });
      }
    }

    if (removedIds.length === 0) return;

    applyStrokeChanges(removedIds, newStrokes);

    if (socket.connected) {
      socket.emit("erase:strokes", removedIds);
      for (const stroke of newStrokes) {
        socket.emit("stroke:add", stroke);
      }
    }
  }, [strokes, eraserMode, eraserSize, removeStrokes, applyStrokeChanges]);

  const performEraseRef = useRef(performErase);
  performEraseRef.current = performErase;

  const scheduleErase = useCallback((point: Point) => {
    pendingErasePointRef.current = point;
    if (eraseFrameRef.current !== null) return;

    eraseFrameRef.current = requestAnimationFrame(() => {
      eraseFrameRef.current = null;
      const latestPoint = pendingErasePointRef.current;
      if (!latestPoint) return;
      pendingErasePointRef.current = null;
      performEraseRef.current(latestPoint);
    });
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
      scheduleErase(point);
      emitCursorPosition(point, true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else if (tool === "text") {
      // Don't capture pointer for text tool - let the input handle it
      e.preventDefault();
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
      scheduleErase(point);
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
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
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
      
      {/* Eraser cursor indicator */}
      {tool === "eraser" && eraserCursor && (
        <div
          className="pointer-events-none absolute rounded-full border-2"
          style={{
            left: 0,
            top: 0,
            width: eraserSize,
            height: eraserSize,
            transform: `translate3d(${eraserCursor.x - eraserSize / 2}px, ${eraserCursor.y - eraserSize / 2}px, 0)`,
            borderColor: eraserMode === "stroke" ? "#ef4444" : "#f59e0b",
            backgroundColor: eraserMode === "stroke" ? "rgba(239, 68, 68, 0.1)" : "rgba(245, 158, 11, 0.1)",
            willChange: "transform",
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
            containerWidth={dimensions.width}
            containerHeight={dimensions.height}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
