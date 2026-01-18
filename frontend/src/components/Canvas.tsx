"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useWhiteboardStore } from "@/store/whiteboard";
import { getSocket } from "@/lib/socket";
import { nanoid } from "nanoid";
import { Point, Stroke, TextItem } from "@/lib/types";
import { clampTextSize, DEFAULT_TEXT_FONT_FAMILY } from "@/lib/typography";
import { TextOverlay } from "./TextOverlay";
import { CursorTooltips } from "./CursorTooltips";

type TextLayout = {
  width: number;
  ascent: number;
  descent: number;
  height: number;
  rotation: number;
};

type TransformState = {
  type: "resize" | "rotate" | "move";
  textId: string;
  anchor: Point;
  startFontSize: number;
  startRotation: number;
  baseDistance?: number;
  lastAngle?: number;
  currentRotation?: number;
  lastEmit?: number;
  pointerOffset?: Point;
  startPosition?: Point;
  centerOffset?: Point;
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const rotatePoint = (point: Point, radians: number): Point => ({
  x: point.x * Math.cos(radians) - point.y * Math.sin(radians),
  y: point.x * Math.sin(radians) + point.y * Math.cos(radians),
});

const TRANSFORM_EMIT_INTERVAL_MS = 33;

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [eraserCursor, setEraserCursor] = useState<Point | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [hoveredTextId, setHoveredTextId] = useState<string | null>(null);
  const isDrawing = useRef(false);
  const transformRef = useRef<TransformState | null>(null);
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

  const textsRef = useRef(texts);
  const updateTextRef = useRef(updateText);

  useEffect(() => {
    textsRef.current = texts;
  }, [texts]);

  useEffect(() => {
    updateTextRef.current = updateText;
  }, [updateText]);

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
    const metrics = ctx.measureText(text.content);
    const ascent = metrics.actualBoundingBoxAscent || text.fontSize;
    const descent = metrics.actualBoundingBoxDescent || Math.max(2, text.fontSize * 0.2);
    const center = {
      x: text.position.x + metrics.width / 2,
      y: text.position.y + (-ascent + descent) / 2,
    };
    const rotationRadians = toRadians(text.rotation ?? 0);
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(rotationRadians);
    ctx.translate(-center.x, -center.y);
    ctx.fillText(text.content, text.position.x, text.position.y);
    ctx.restore();
  }, []);

  const drawHoverHighlight = useCallback((ctx: CanvasRenderingContext2D, text: TextItem) => {
    const resolvedFontFamily = text.fontFamily || DEFAULT_TEXT_FONT_FAMILY;
    ctx.font = `${text.fontSize}px ${resolvedFontFamily}`;
    ctx.textBaseline = "alphabetic";
    const metrics = ctx.measureText(text.content);
    const ascent = metrics.actualBoundingBoxAscent || text.fontSize;
    const descent = metrics.actualBoundingBoxDescent || Math.max(2, text.fontSize * 0.2);
    const center = {
      x: text.position.x + metrics.width / 2,
      y: text.position.y + (-ascent + descent) / 2,
    };
    const rotationRadians = toRadians(text.rotation ?? 0);
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.translate(center.x, center.y);
    ctx.rotate(rotationRadians);
    ctx.translate(-center.x, -center.y);
    ctx.shadowColor = "rgba(147, 197, 253, 0.7)";
    ctx.shadowBlur = Math.max(3, Math.round(text.fontSize * 0.22));
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = Math.max(1, Math.round(text.fontSize * 0.1));
    ctx.strokeText(text.content, text.position.x, text.position.y);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(147, 197, 253, 0.6)";
    ctx.lineWidth = Math.max(1, Math.round(text.fontSize * 0.05));
    ctx.strokeText(text.content, text.position.x, text.position.y);
    ctx.restore();
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

    if (
      tool !== "eraser" &&
      !textInputPosition &&
      hoveredTextId &&
      hoveredTextId !== selectedTextId
    ) {
      const hoveredText = texts[hoveredTextId];
      if (hoveredText) {
        drawHoverHighlight(ctx, hoveredText);
      }
    }

    // Draw all texts
    Object.values(texts).forEach((text) => {
      drawText(ctx, text);
    });
  }, [
    strokes,
    texts,
    currentStroke,
    userId,
    tool,
    textInputPosition,
    hoveredTextId,
    selectedTextId,
    drawStroke,
    drawText,
    drawHoverHighlight,
  ]);

  // Redraw on state changes and dimension changes
  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0) {
      requestAnimationFrame(draw);
    }
  }, [draw, dimensions]);

  useEffect(() => {
    if (tool === "eraser") {
      setSelectedTextId(null);
      setHoveredTextId(null);
    }
  }, [tool]);

  useEffect(() => {
    if (selectedTextId && !texts[selectedTextId]) {
      setSelectedTextId(null);
    }
  }, [selectedTextId, texts]);

  useEffect(() => {
    if (textInputPosition) {
      setHoveredTextId(null);
    }
  }, [textInputPosition]);

  useEffect(() => {
    if (hoveredTextId && !texts[hoveredTextId]) {
      setHoveredTextId(null);
    }
  }, [hoveredTextId, texts]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditableTarget = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (event.key === "Escape") {
        if (textInputPosition) return;
        if (!selectedTextId && !hoveredTextId) return;
        stopTransformRef.current();
        setSelectedTextId(null);
        setHoveredTextId(null);
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && selectedTextId) {
        if (textInputPosition || isEditableTarget) return;
        event.preventDefault();
        handleDeleteSelectedText();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTextId, hoveredTextId, textInputPosition]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!selectedTextId && !hoveredTextId) return;
      if (textInputPosition) return;
      const container = containerRef.current;
      if (!container) return;
      if (container.contains(event.target as Node)) return;
      stopTransformRef.current();
      setSelectedTextId(null);
      setHoveredTextId(null);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [selectedTextId, hoveredTextId, textInputPosition]);


  const getTextLayout = useCallback((ctx: CanvasRenderingContext2D, text: TextItem): TextLayout => {
    const resolvedFontFamily = text.fontFamily || DEFAULT_TEXT_FONT_FAMILY;
    ctx.font = `${text.fontSize}px ${resolvedFontFamily}`;
    ctx.textBaseline = "alphabetic";
    const metrics = ctx.measureText(text.content);
    const ascent = metrics.actualBoundingBoxAscent || text.fontSize;
    const descent = metrics.actualBoundingBoxDescent || Math.max(2, text.fontSize * 0.2);
    return {
      width: metrics.width,
      ascent,
      descent,
      height: ascent + descent,
      rotation: text.rotation ?? 0,
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
      const layout = getTextLayout(ctx, text);
      const rotation = toRadians(layout.rotation);
      const center = {
        x: text.position.x + layout.width / 2,
        y: text.position.y + (-layout.ascent + layout.descent) / 2,
      };
      const localPoint = {
        x: point.x - center.x,
        y: point.y - center.y,
      };
      const unrotated = rotatePoint(localPoint, -rotation);
      const halfWidth = layout.width / 2;
      const halfHeight = layout.height / 2;
      if (
        unrotated.x >= -halfWidth - padding &&
        unrotated.x <= halfWidth + padding &&
        unrotated.y >= -halfHeight - padding &&
        unrotated.y <= halfHeight + padding
      ) {
        return text.id;
      }
    }

    return null;
  }, [getTextLayout, texts]);

  const getPointFromClient = useCallback((clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const getPointerPosition = (e: React.PointerEvent): Point => {
    return getPointFromClient(e.clientX, e.clientY);
  };

  const getWindowPointerPosition = useCallback((event: PointerEvent): Point => {
    return getPointFromClient(event.clientX, event.clientY);
  }, [getPointFromClient]);

  useEffect(() => {
    const handleDoubleClick = (event: MouseEvent) => {
      if (!selectedTextId && !hoveredTextId) return;
      if (textInputPosition) return;
      const container = containerRef.current;
      if (!container) return;
      const isInside = container.contains(event.target as Node);
      if (!isInside) {
        stopTransformRef.current();
        setSelectedTextId(null);
        setHoveredTextId(null);
        return;
      }

      const point = getPointFromClient(event.clientX, event.clientY);
      const hitTextId = findTextAtPoint(point);
      if (!hitTextId) {
        stopTransformRef.current();
        setSelectedTextId(null);
        setHoveredTextId(null);
      }
    };

    window.addEventListener("dblclick", handleDoubleClick);
    return () => window.removeEventListener("dblclick", handleDoubleClick);
  }, [findTextAtPoint, getPointFromClient, selectedTextId, hoveredTextId, textInputPosition]);

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

  const stopTransformRef = useRef<() => void>(() => {});

  const handleTransformMove = useCallback((event: PointerEvent) => {
    const transform = transformRef.current;
    if (!transform) return;

    const currentText = textsRef.current[transform.textId];
    if (!currentText) {
      stopTransformRef.current();
      return;
    }

    const pointer = getWindowPointerPosition(event);

    if (transform.type === "resize") {
      const rotationRadians = toRadians(transform.startRotation);
      const relativePoint = {
        x: pointer.x - transform.anchor.x,
        y: pointer.y - transform.anchor.y,
      };
      const unrotated = rotatePoint(relativePoint, -rotationRadians);
      const centerOffset = transform.centerOffset ?? { x: 0, y: 0 };
      const localPoint = {
        x: unrotated.x + centerOffset.x,
        y: unrotated.y + centerOffset.y,
      };
      const distance = Math.max(1, Math.hypot(localPoint.x, localPoint.y));
      const base = Math.max(1, transform.baseDistance ?? 1);
      const nextSize = clampTextSize(transform.startFontSize * (distance / base));

      const updatedText: TextItem = {
        ...currentText,
        fontSize: nextSize,
        fontFamily: currentText.fontFamily || DEFAULT_TEXT_FONT_FAMILY,
        rotation: currentText.rotation ?? transform.startRotation,
      };

      updateTextRef.current(updatedText);
      const socket = getSocket();
      const now = Date.now();
      if (socket.connected && (transform.lastEmit ? now - transform.lastEmit >= TRANSFORM_EMIT_INTERVAL_MS : true)) {
        socket.emit("text:update", updatedText);
        transform.lastEmit = now;
      }
    }

    if (transform.type === "rotate") {
      const currentAngle = Math.atan2(
        pointer.y - transform.anchor.y,
        pointer.x - transform.anchor.x
      );
      const previousAngle = transform.lastAngle ?? currentAngle;
      let delta = currentAngle - previousAngle;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;

      const baseRotation = transform.currentRotation ?? transform.startRotation;
      const nextRotation = baseRotation + (delta * 180) / Math.PI;

      transform.lastAngle = currentAngle;
      transform.currentRotation = nextRotation;

      const updatedText: TextItem = {
        ...currentText,
        fontFamily: currentText.fontFamily || DEFAULT_TEXT_FONT_FAMILY,
        rotation: nextRotation,
      };

      updateTextRef.current(updatedText);
      const socket = getSocket();
      const now = Date.now();
      if (socket.connected && (transform.lastEmit ? now - transform.lastEmit >= TRANSFORM_EMIT_INTERVAL_MS : true)) {
        socket.emit("text:update", updatedText);
        transform.lastEmit = now;
      }
    }

    if (transform.type === "move") {
      const offset = transform.pointerOffset ?? { x: 0, y: 0 };
      const nextPosition = {
        x: pointer.x - offset.x,
        y: pointer.y - offset.y,
      };

      const updatedText: TextItem = {
        ...currentText,
        position: nextPosition,
      };

      updateTextRef.current(updatedText);
      const socket = getSocket();
      const now = Date.now();
      if (socket.connected && (transform.lastEmit ? now - transform.lastEmit >= TRANSFORM_EMIT_INTERVAL_MS : true)) {
        socket.emit("text:update", updatedText);
        transform.lastEmit = now;
      }
    }

  }, [getWindowPointerPosition]);

  const handleTransformEnd = useCallback(() => {
    const transform = transformRef.current;
    if (transform) {
      const currentText = textsRef.current[transform.textId];
      const socket = getSocket();
      if (currentText && socket.connected) {
        socket.emit("text:update", currentText);
      }
    }
    stopTransformRef.current();
  }, []);

  const stopTransform = useCallback(() => {
    transformRef.current = null;
    window.removeEventListener("pointermove", handleTransformMove);
    window.removeEventListener("pointerup", handleTransformEnd);
    window.removeEventListener("pointercancel", handleTransformEnd);
  }, [handleTransformEnd, handleTransformMove]);

  useEffect(() => {
    stopTransformRef.current = stopTransform;
    return () => stopTransform();
  }, [stopTransform]);

  const beginTransform = (nextTransform: TransformState) => {
    stopTransformRef.current();
    transformRef.current = nextTransform;
    window.addEventListener("pointermove", handleTransformMove);
    window.addEventListener("pointerup", handleTransformEnd);
    window.addEventListener("pointercancel", handleTransformEnd);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Don't handle if text input is already open
    if (textInputPosition) return;
    
    const point = getPointerPosition(e);

    if (tool === "pen") {
      const hitTextId = findTextAtPoint(point);
      if (hitTextId) {
        setSelectedTextId(hitTextId);
        setTextInputPosition(null);
        return;
      }

      setSelectedTextId(null);
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
      setHoveredTextId(null);
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
    
    if (!isDrawing.current) {
      if ((tool === "text" || tool === "pen") && !textInputPosition && !transformRef.current) {
        const hitTextId = findTextAtPoint(point);
        if (hitTextId !== hoveredTextId) {
          setHoveredTextId(hitTextId);
        }
      } else if (hoveredTextId) {
        setHoveredTextId(null);
      }
      return;
    }

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
    setHoveredTextId(null);
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
      rotation: 0,
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
  const selectedLayout = useMemo(() => {
    if (!selectedText) return null;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return null;
    return getTextLayout(ctx, selectedText);
  }, [selectedText, getTextLayout, dimensions]);
  const selectionBox = useMemo(() => {
    if (!selectedText || !selectedLayout) return null;
    return {
      left: selectedText.position.x,
      top: selectedText.position.y - selectedLayout.ascent,
      width: selectedLayout.width,
      height: selectedLayout.height,
      rotation: selectedLayout.rotation,
    };
  }, [selectedLayout, selectedText]);

  const resizeHandleSize = 10;
  const rotateHandleSize = 12;
  const rotateHandleOffset = 28;
  const selectionHandles = useMemo(() => {
    if (!selectedText || !selectedLayout) return null;
    const rotation = toRadians(selectedLayout.rotation);
    const center = {
      x: selectedText.position.x + selectedLayout.width / 2,
      y: selectedText.position.y + (-selectedLayout.ascent + selectedLayout.descent) / 2,
    };
    const halfWidth = selectedLayout.width / 2;
    const halfHeight = selectedLayout.height / 2;
    const bottomRight = rotatePoint({ x: halfWidth, y: halfHeight }, rotation);
    const topCenter = rotatePoint({ x: 0, y: -halfHeight }, rotation);
    const rotateHandle = rotatePoint(
      { x: 0, y: -halfHeight - rotateHandleOffset },
      rotation
    );

    return {
      resize: { x: center.x + bottomRight.x, y: center.y + bottomRight.y },
      rotate: { x: center.x + rotateHandle.x, y: center.y + rotateHandle.y },
      rotateLine: {
        start: { x: center.x + topCenter.x, y: center.y + topCenter.y },
        end: { x: center.x + rotateHandle.x, y: center.y + rotateHandle.y },
      },
    };
  }, [selectedLayout, selectedText, rotateHandleOffset]);

  const rotateLine = useMemo(() => {
    if (!selectionHandles) return null;
    const dx = selectionHandles.rotateLine.end.x - selectionHandles.rotateLine.start.x;
    const dy = selectionHandles.rotateLine.end.y - selectionHandles.rotateLine.start.y;
    return {
      left: selectionHandles.rotateLine.start.x,
      top: selectionHandles.rotateLine.start.y,
      length: Math.hypot(dx, dy),
      angle: Math.atan2(dy, dx),
    };
  }, [selectionHandles]);

  const handleDeleteSelectedText = () => {
    if (!selectedText) return;
    removeText(selectedText.id);
    setSelectedTextId(null);

    const socket = getSocket();
    if (socket.connected) {
      socket.emit("text:remove", selectedText.id);
    }
  };

  const handleResizeStart = (e: React.PointerEvent) => {
    if (!selectedText || !selectedLayout) return;
    e.preventDefault();
    e.stopPropagation();
    setHoveredTextId(null);
    const centerOffset = {
      x: selectedLayout.width / 2,
      y: (-selectedLayout.ascent + selectedLayout.descent) / 2,
    };
    const center = {
      x: selectedText.position.x + centerOffset.x,
      y: selectedText.position.y + centerOffset.y,
    };
    const baseDistance = Math.max(
      1,
      Math.hypot(selectedLayout.width, selectedLayout.descent)
    );

    beginTransform({
      type: "resize",
      textId: selectedText.id,
      anchor: center,
      startFontSize: selectedText.fontSize,
      startRotation: selectedLayout.rotation,
      baseDistance,
      centerOffset,
    });
  };

  const handleRotateStart = (e: React.PointerEvent) => {
    if (!selectedText || !selectedLayout) return;
    e.preventDefault();
    e.stopPropagation();
    setHoveredTextId(null);
    const center = {
      x: selectedText.position.x + selectedLayout.width / 2,
      y: selectedText.position.y + (-selectedLayout.ascent + selectedLayout.descent) / 2,
    };
    const pointer = getPointerPosition(e);
    const startAngle = Math.atan2(
      pointer.y - center.y,
      pointer.x - center.x
    );

    beginTransform({
      type: "rotate",
      textId: selectedText.id,
      anchor: center,
      startFontSize: selectedText.fontSize,
      startRotation: selectedLayout.rotation,
      lastAngle: startAngle,
      currentRotation: selectedText.rotation ?? 0,
    });
  };

  const handleMoveStart = (e: React.PointerEvent) => {
    if (!selectedText || !selectedLayout) return;
    e.preventDefault();
    e.stopPropagation();
    setHoveredTextId(null);
    const pointer = getPointerPosition(e);
    const pointerOffset = {
      x: pointer.x - selectedText.position.x,
      y: pointer.y - selectedText.position.y,
    };

    beginTransform({
      type: "move",
      textId: selectedText.id,
      anchor: selectedText.position,
      startFontSize: selectedText.fontSize,
      startRotation: selectedLayout.rotation,
      pointerOffset,
      startPosition: selectedText.position,
    });
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

      {tool !== "eraser" && !textInputPosition && selectedText && selectedLayout && selectionBox && (
        <>
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute"
              style={{
                left: selectionBox.left,
                top: selectionBox.top,
                width: selectionBox.width,
                height: selectionBox.height,
                transform: `rotate(${selectionBox.rotation}deg)`,
                transformOrigin: "50% 50%",
              }}
            >
              <div
                className="absolute inset-0 rounded-md border border-(--primary)"
              />
            </div>
          </div>
          <div className="absolute inset-0">
            <div
              className="absolute"
              style={{
                left: selectionBox.left,
                top: selectionBox.top,
                width: selectionBox.width,
                height: selectionBox.height,
                transform: `rotate(${selectionBox.rotation}deg)`,
                transformOrigin: "50% 50%",
              }}
            >
              <div
                onPointerDown={handleMoveStart}
                className="absolute inset-0 cursor-move"
                title="Move text"
              >
                <span className="sr-only">Move text</span>
              </div>
            </div>
          </div>
          {selectionHandles && (
            <div className="absolute inset-0 z-30 pointer-events-none">
              {rotateLine && (
                <div
                  className="pointer-events-none absolute h-px bg-(--primary)"
                  style={{
                    left: rotateLine.left,
                    top: rotateLine.top,
                    width: rotateLine.length,
                    transform: `rotate(${rotateLine.angle}rad)`,
                    transformOrigin: "0 0",
                  }}
                />
              )}
              <button
                onPointerDown={handleRotateStart}
                className="absolute rounded-full bg-white border border-(--primary) shadow cursor-grab pointer-events-auto"
                style={{
                  left: selectionHandles.rotate.x - rotateHandleSize / 2,
                  top: selectionHandles.rotate.y - rotateHandleSize / 2,
                  width: rotateHandleSize,
                  height: rotateHandleSize,
                }}
                title="Rotate text"
              >
                <span className="sr-only">Rotate text</span>
              </button>
              <button
                onPointerDown={handleResizeStart}
                className="absolute bg-white border border-(--primary) rounded-sm shadow cursor-nwse-resize pointer-events-auto"
                style={{
                  left: selectionHandles.resize.x - resizeHandleSize / 2,
                  top: selectionHandles.resize.y - resizeHandleSize / 2,
                  width: resizeHandleSize,
                  height: resizeHandleSize,
                }}
                title="Resize text"
              >
                <span className="sr-only">Resize text</span>
              </button>
            </div>
          )}
        </>
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
