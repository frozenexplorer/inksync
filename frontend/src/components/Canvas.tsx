"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useWhiteboardStore } from "@/store/whiteboard";
import { getSocket } from "@/lib/socket";
import { nanoid } from "nanoid";
import { Point, Stroke, TextItem, ShapeItem, Tool } from "@/lib/types";
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
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;

// Helper for shape hit testing
const hitTestShape = (shape: ShapeItem, point: Point, radius: number): boolean => {
  const padding = shape.thickness / 2 + radius;
  const x = Math.min(shape.start.x, shape.end.x) - padding;
  const y = Math.min(shape.start.y, shape.end.y) - padding;
  const w = Math.abs(shape.start.x - shape.end.x) + padding * 2;
  const h = Math.abs(shape.start.y - shape.end.y) + padding * 2;

  // 1. Broad Phase: Bounding Box
  if (point.x < x || point.x > x + w || point.y < y || point.y > y + h) {
    return false;
  }

  // 2. Narrow Phase by Type
  if (shape.type === "rectangle") {
    return true;
  } else if (shape.type === "ellipse") {
    const cx = shape.start.x + (shape.end.x - shape.start.x) / 2;
    const cy = shape.start.y + (shape.end.y - shape.start.y) / 2;
    const rx = Math.abs(shape.end.x - shape.start.x) / 2 + padding;
    const ry = Math.abs(shape.end.y - shape.start.y) / 2 + padding;
    // (x-cx)^2/rx^2 + (y-cy)^2/ry^2 <= 1
    const val = Math.pow(point.x - cx, 2) / (rx * rx) + Math.pow(point.y - cy, 2) / (ry * ry);
    return val <= 1;
  } else if (shape.type === "line" || shape.type === "arrow") {
    const { start, end } = shape;
    const l2 = Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2);
    if (l2 === 0) return Math.hypot(point.x - start.x, point.y - start.y) <= radius;

    let t = ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const px = start.x + t * (end.x - start.x);
    const py = start.y + t * (end.y - start.y);
    const dist = Math.hypot(point.x - px, point.y - py);
    return dist <= radius + shape.thickness / 2;
  }

  return false;
};

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const panOffsetRef = useRef(panOffset);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const [isPanning, setIsPanning] = useState(false);
  const [eraserCursor, setEraserCursor] = useState<Point | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [hoveredTextId, setHoveredTextId] = useState<string | null>(null);
  const isDrawing = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ origin: Point; offset: Point; pointerId: number } | null>(null);
  const lastNonPanToolRef = useRef<Tool>("pen");
  const transformRef = useRef<TransformState | null>(null);
  const lastPoint = useRef<Point | null>(null);
  const lastCursorEmit = useRef(0);
  const eraseFrameRef = useRef<number | null>(null);
  const pendingErasePointRef = useRef<Point | null>(null);
  const [currentShape, setCurrentShape] = useState<{ start: Point; end: Point } | null>(null);

  const {
    strokes,
    texts,
    shapes,
    currentStroke,
    tool,
    penColor,
    penThickness,
    shapeType,
    fill,
    dash,
    opacity,
    fontSize,
    fontFamily,
    userId,
    textInputPosition,
    eraserMode,
    eraserSize,
    startStroke,
    extendStroke,
    finishStroke,
    setTool,
    setTextInputPosition,
    removeStrokes,
    applyStrokeChanges,
    addStroke,
    addText,
    updateText,
    removeText,
    addShape,
    updateShape,
    removeShape,
  } = useWhiteboardStore();

  const textsRef = useRef(texts);
  const updateTextRef = useRef(updateText);

  useEffect(() => {
    textsRef.current = texts;
  }, [texts]);

  useEffect(() => {
    updateTextRef.current = updateText;
  }, [updateText]);

  useEffect(() => {
    panOffsetRef.current = panOffset;
  }, [panOffset]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    if (tool !== "pan") {
      lastNonPanToolRef.current = tool;
    }
  }, [tool]);

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

  const drawShape = useCallback((ctx: CanvasRenderingContext2D, shape: ShapeItem | { type: string; start: Point; end: Point; color: string; thickness: number; fill?: boolean; dash?: string; opacity?: number }) => {
    ctx.save();
    ctx.strokeStyle = shape.color;
    ctx.fillStyle = shape.color; // For fill
    ctx.lineWidth = shape.thickness;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = shape.opacity ?? 1;

    if (shape.dash === "dashed") {
      ctx.setLineDash([shape.thickness * 2, shape.thickness * 2]);
    } else if (shape.dash === "dotted") {
      ctx.setLineDash([shape.thickness, shape.thickness]);
    } else {
      ctx.setLineDash([]);
    }

    const { start, end } = shape;
    const width = end.x - start.x;
    const height = end.y - start.y;

    ctx.beginPath();

    if (shape.type === "rectangle") {
      if (shape.fill) {
        ctx.globalAlpha = (shape.opacity ?? 1) * 0.2; // lighter fill
        ctx.fillRect(start.x, start.y, width, height);
        ctx.globalAlpha = shape.opacity ?? 1;
      }
      ctx.strokeRect(start.x, start.y, width, height);
    } else if (shape.type === "ellipse") {
      const centerX = start.x + width / 2;
      const centerY = start.y + height / 2;
      const radiusX = Math.abs(width / 2);
      const radiusY = Math.abs(height / 2);
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
      if (shape.fill) {
        ctx.globalAlpha = (shape.opacity ?? 1) * 0.2;
        ctx.fill();
        ctx.globalAlpha = shape.opacity ?? 1;
      }
      ctx.stroke();
    } else if (shape.type === "line") {
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (shape.type === "arrow") {
      // Draw line
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      // Draw arrowhead
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headLength = Math.max(10, shape.thickness * 3);
      ctx.setLineDash([]); // Arrowhead always solid
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headLength * Math.cos(angle - Math.PI / 6),
        end.y - headLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headLength * Math.cos(angle + Math.PI / 6),
        end.y - headLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
    }

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
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(zoom, 0, 0, zoom, panOffset.x, panOffset.y);

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

    // Draw all finalized shapes
    Object.values(shapes).forEach((shape) => {
      drawShape(ctx, shape);
    });

    // Draw current shape (being drawn)
    if (currentShape) {
      drawShape(ctx, {
        type: shapeType,
        start: currentShape.start,
        end: currentShape.end,
        color: penColor,
        thickness: penThickness,
        fill,
        dash,
        opacity,
      });
    }
  }, [
    strokes,
    texts,
    shapes,
    currentStroke,
    currentShape,
    shapeType,
    userId,
    tool,
    penColor,
    penThickness,
    fill,
    dash,
    opacity,
    textInputPosition,
    hoveredTextId,
    selectedTextId,
    panOffset,
    zoom,
    drawStroke,
    drawText,
    drawShape,
    drawHoverHighlight,
  ]);

  // Redraw on state changes and dimension changes
  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0) {
      requestAnimationFrame(draw);
    }
  }, [draw, dimensions]);

  useEffect(() => {
    if (tool === "eraser" || tool === "pan") {
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
        const textToDelete = texts[selectedTextId];
        if (textToDelete) {
          removeText(selectedTextId);
          setSelectedTextId(null);
          const socket = getSocket();
          if (socket.connected) {
            socket.emit("text:remove", selectedTextId)
          }
        }
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

  const toWorldPoint = useCallback((point: Point): Point => {
    const currentZoom = zoomRef.current || 1;
    return {
      x: (point.x - panOffsetRef.current.x) / currentZoom,
      y: (point.y - panOffsetRef.current.y) / currentZoom,
    };
  }, []);

  const getPointerPosition = (e: React.PointerEvent): Point => {
    const screenPoint = getPointFromClient(e.clientX, e.clientY);
    return toWorldPoint(screenPoint);
  };

  const getWindowPointerPosition = useCallback((event: PointerEvent): Point => {
    const screenPoint = getPointFromClient(event.clientX, event.clientY);
    return toWorldPoint(screenPoint);
  }, [getPointFromClient, toWorldPoint]);

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

      const screenPoint = getPointFromClient(event.clientX, event.clientY);
      const point = toWorldPoint(screenPoint);
      const hitTextId = findTextAtPoint(point);
      if (!hitTextId) {
        stopTransformRef.current();
        setSelectedTextId(null);
        setHoveredTextId(null);
      }
    };

    window.addEventListener("dblclick", handleDoubleClick);
    return () => window.removeEventListener("dblclick", handleDoubleClick);
  }, [findTextAtPoint, getPointFromClient, toWorldPoint, selectedTextId, hoveredTextId, textInputPosition]);

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
    } else {
      // Pixel Eraser for Strokes (existing logic)
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

      if (removedIds.length > 0) {
        applyStrokeChanges(removedIds, newStrokes);
        const socket = getSocket();
        if (socket.connected) {
          socket.emit("erase:strokes", removedIds);
          for (const stroke of newStrokes) {
            socket.emit("stroke:add", stroke);
          }
        }
      }
    }

    // Checking for shapes to erase (in both modes)
    const shapesToErase: string[] = [];
    const shapeList = Object.values(shapes);

    for (const shape of shapeList) {
      if (hitTestShape(shape, point, eraserSize / 2)) {
        shapesToErase.push(shape.id);
      }
    }

    if (shapesToErase.length > 0) {
      shapesToErase.forEach(id => removeShape(id));
      if (socket.connected) {
        shapesToErase.forEach(id => socket.emit("shape:remove", id));
      }
    }
  }, [strokes, shapes, eraserMode, eraserSize, removeStrokes, applyStrokeChanges, removeShape]);

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

  const stopTransformRef = useRef<() => void>(() => { });

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

  // Update ref during render - this is safe for refs and keeps it in sync
  // This pattern is necessary for event handlers that need the latest callback
  // eslint-disable-next-line
  stopTransformRef.current = stopTransform;

  useEffect(() => {
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

    const screenPoint = getPointFromClient(e.clientX, e.clientY);
    const point = toWorldPoint(screenPoint);
    const shouldPan = e.button === 1 || (tool === "pan" && e.button === 0);

    if (shouldPan) {
      e.preventDefault();
      setHoveredTextId(null);
      setEraserCursor(null);
      isDrawing.current = false;
      lastPoint.current = null;
      panStartRef.current = {
        origin: screenPoint,
        offset: panOffsetRef.current,
        pointerId: e.pointerId,
      };
      isPanningRef.current = true;
      setIsPanning(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

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
      scheduleErase(point);
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
    } else if (tool === "shape") {
      isDrawing.current = true;
      lastPoint.current = point;
      setCurrentShape({ start: point, end: point });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const screenPoint = getPointFromClient(e.clientX, e.clientY);
    const point = toWorldPoint(screenPoint);

    if (isPanningRef.current) {
      const panStart = panStartRef.current;
      if (!panStart) return;
      const dx = screenPoint.x - panStart.origin.x;
      const dy = screenPoint.y - panStart.origin.y;
      const nextOffset = {
        x: panStart.offset.x + dx,
        y: panStart.offset.y + dy,
      };
      panOffsetRef.current = nextOffset;
      setPanOffset(nextOffset);
      return;
    }

    // Update eraser cursor position for visual indicator
    if (tool === "eraser") {
      setEraserCursor(screenPoint);
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
      emitCursorPosition(point, true);
    } else if (tool === "shape" && currentShape) {
      setCurrentShape({ ...currentShape, end: point });
      // Throttle shape updates if needed, but for local drawing 60fps is fine
    }
  };

  const handlePointerLeaveCanvas = (e: React.PointerEvent) => {
    setEraserCursor(null);
    setHoveredTextId(null);
    if (isPanningRef.current) {
      return;
    }
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
      } else if (tool === "shape" && currentShape) {
        if (userId) {
          const shape: ShapeItem = {
            id: nanoid(),
            type: shapeType,
            start: currentShape.start,
            end: currentShape.end,
            color: penColor,
            thickness: penThickness,
            fill,
            dash,
            opacity,
            authorId: userId,
          };
          addShape(shape);
          getSocket().emit("shape:add", shape);
        }
        setCurrentShape(null);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanningRef.current) {
      const panStart = panStartRef.current;
      isPanningRef.current = false;
      panStartRef.current = null;
      setIsPanning(false);
      if (panStart) {
        (e.target as HTMLElement).releasePointerCapture(panStart.pointerId);
      }
      return;
    }
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
    } else if (tool === "shape" && currentShape) {
      if (userId) {
        const shape: ShapeItem = {
          id: nanoid(),
          type: shapeType,
          start: currentShape.start,
          end: currentShape.end,
          color: penColor,
          thickness: penThickness,
          fill,
          dash,
          opacity,
          authorId: userId,
        };
        addShape(shape);
        getSocket().emit("shape:add", shape);
      }
      setCurrentShape(null);
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
  const selectionBoxScreen = useMemo(() => {
    if (!selectionBox) return null;
    return {
      ...selectionBox,
      left: selectionBox.left * zoom + panOffset.x,
      top: selectionBox.top * zoom + panOffset.y,
      width: selectionBox.width * zoom,
      height: selectionBox.height * zoom,
    };
  }, [panOffset, selectionBox, zoom]);

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

  const textOverlayPosition = useMemo(() => {
    if (!textInputPosition) return null;
    return {
      x: textInputPosition.x * zoom + panOffset.x,
      y: textInputPosition.y * zoom + panOffset.y,
    };
  }, [panOffset, textInputPosition, zoom]);

  const handleDeleteSelectedText = () => {
    if (!selectedText) return;
    removeText(selectedText.id);
    setSelectedTextId(null);

    const socket = getSocket();
    if (socket.connected) {
      socket.emit("text:remove", selectedText.id);
    }
  };

  const clampZoom = (value: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));

  const updateZoom = (nextZoom: number) => {
    const currentZoom = zoomRef.current || 1;
    const clampedZoom = clampZoom(nextZoom);
    if (Math.abs(clampedZoom - currentZoom) < 0.001) return;

    const anchor = {
      x: dimensions.width / 2,
      y: dimensions.height / 2,
    };
    const currentPan = panOffsetRef.current;
    const worldAtAnchor = {
      x: (anchor.x - currentPan.x) / currentZoom,
      y: (anchor.y - currentPan.y) / currentZoom,
    };
    const nextPan = {
      x: anchor.x - worldAtAnchor.x * clampedZoom,
      y: anchor.y - worldAtAnchor.y * clampedZoom,
    };

    panOffsetRef.current = nextPan;
    setPanOffset(nextPan);
    zoomRef.current = clampedZoom;
    setZoom(clampedZoom);
  };

  const handleTogglePan = () => {
    if (tool === "pan") {
      setTool(lastNonPanToolRef.current);
      return;
    }
    setTool("pan");
  };

  const handleSwitchToPen = () => {
    setTool("pen");
  };

  const handleZoomIn = () => {
    updateZoom(zoomRef.current + ZOOM_STEP);
  };

  const handleZoomOut = () => {
    updateZoom(zoomRef.current - ZOOM_STEP);
  };

  const handleResetView = () => {
    const resetPan = { x: 0, y: 0 };
    panOffsetRef.current = resetPan;
    setPanOffset(resetPan);
    zoomRef.current = 1;
    setZoom(1);
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
      case "pan":
        return "cursor-grab";
      case "shape":
        return "cursor-crosshair";
      default:
        return "";
    }
  };

  const isViewCentered = panOffset.x === 0 && panOffset.y === 0 && zoom === 1;
  const isZoomMin = zoom <= ZOOM_MIN + 0.001;
  const isZoomMax = zoom >= ZOOM_MAX - 0.001;
  const eraserScreenSize = Math.max(2, eraserSize * zoom);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className={`w-full h-full touch-none bg-white ${isPanning ? "cursor-grabbing" : getCursorClass()}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeaveCanvas}
      />

      <div className="absolute right-4 top-4 z-40 flex items-center gap-2 rounded-xl border border-(--border) bg-(--surface)/90 p-1.5 shadow-lg backdrop-blur">
        <button
          onClick={handleTogglePan}
          aria-label="Toggle pan tool"
          aria-pressed={tool === "pan"}
          title="Pan tool (or hold middle mouse button)"
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${tool === "pan"
            ? "bg-(--primary) text-black"
            : "text-(--text-muted) hover:bg-(--surface-hover) hover:text-white"
            }`}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 11V5a1 1 0 112 0v6m2 0V4a1 1 0 112 0v7m2 0V6a1 1 0 112 0v5m2 0V9a1 1 0 112 0v6a4 4 0 01-4 4h-5a4 4 0 01-4-4v-1a2 2 0 012-2h2"
            />
          </svg>
        </button>
        <button
          onClick={handleSwitchToPen}
          aria-label="Select pen tool"
          aria-pressed={tool === "pen"}
          title="Pen tool"
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${tool === "pen"
            ? "bg-(--primary) text-black"
            : "text-(--text-muted) hover:bg-(--surface-hover) hover:text-white"
            }`}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      </div>

      <div className="absolute top-4 left-4 min-[967px]:top-auto min-[967px]:left-auto min-[967px]:bottom-4 min-[967px]:right-4 z-40 flex items-center gap-2 rounded-xl border border-(--border) bg-(--surface)/90 px-2 py-1.5 shadow-lg backdrop-blur">
        <button
          onClick={handleZoomOut}
          aria-label="Zoom out"
          title="Zoom out"
          disabled={isZoomMin}
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${isZoomMin
            ? "cursor-not-allowed opacity-50 text-(--text-muted)"
            : "text-(--text-muted) hover:bg-(--surface-hover) hover:text-white"
            }`}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
          </svg>
        </button>
        <span className="min-w-[46px] text-center text-xs font-semibold text-(--text-muted)">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          aria-label="Zoom in"
          title="Zoom in"
          disabled={isZoomMax}
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${isZoomMax
            ? "cursor-not-allowed opacity-50 text-(--text-muted)"
            : "text-(--text-muted) hover:bg-(--surface-hover) hover:text-white"
            }`}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m-7-7h14" />
          </svg>
        </button>
        <div className="h-6 w-px bg-(--border)" />
        <button
          onClick={handleResetView}
          aria-label="Reset view"
          title="Reset view"
          disabled={isViewCentered}
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${isViewCentered
            ? "cursor-not-allowed opacity-50 text-(--text-muted)"
            : "text-(--text-muted) hover:bg-(--surface-hover) hover:text-white"
            }`}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" strokeWidth={2} />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v4m0 8v4m8-8h-4M8 12H4" />
          </svg>
        </button>
      </div>

      {tool !== "eraser" && !textInputPosition && selectedText && selectedLayout && selectionBoxScreen && (
        <>
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute"
              style={{
                left: selectionBoxScreen.left,
                top: selectionBoxScreen.top,
                width: selectionBoxScreen.width,
                height: selectionBoxScreen.height,
                transform: `rotate(${selectionBoxScreen.rotation}deg)`,
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
                left: selectionBoxScreen.left,
                top: selectionBoxScreen.top,
                width: selectionBoxScreen.width,
                height: selectionBoxScreen.height,
                transform: `rotate(${selectionBoxScreen.rotation}deg)`,
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
                    left: rotateLine.left * zoom + panOffset.x,
                    top: rotateLine.top * zoom + panOffset.y,
                    width: rotateLine.length * zoom,
                    transform: `rotate(${rotateLine.angle}rad)`,
                    transformOrigin: "0 0",
                  }}
                />
              )}
              <button
                onPointerDown={handleRotateStart}
                className="absolute rounded-full bg-white border border-(--primary) shadow cursor-grab pointer-events-auto"
                style={{
                  left: selectionHandles.rotate.x * zoom + panOffset.x - rotateHandleSize / 2,
                  top: selectionHandles.rotate.y * zoom + panOffset.y - rotateHandleSize / 2,
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
                  left: selectionHandles.resize.x * zoom + panOffset.x - resizeHandleSize / 2,
                  top: selectionHandles.resize.y * zoom + panOffset.y - resizeHandleSize / 2,
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
          className="pointer-events-none absolute rounded-full border-2"
          style={{
            left: 0,
            top: 0,
            width: eraserScreenSize,
            height: eraserScreenSize,
            transform: `translate3d(${eraserCursor.x - eraserScreenSize / 2}px, ${eraserCursor.y - eraserScreenSize / 2}px, 0)`,
            borderColor: eraserMode === "stroke" ? "#ef4444" : "#f59e0b",
            backgroundColor: eraserMode === "stroke" ? "rgba(239, 68, 68, 0.1)" : "rgba(245, 158, 11, 0.1)",
            willChange: "transform",
          }}
        />
      )}

      {/* Remote cursor tooltips */}
      <CursorTooltips offset={panOffset} zoom={zoom} />

      {/* Text input overlay */}
      <AnimatePresence>
        {textOverlayPosition && (
          <TextOverlay
            key="text-overlay"
            position={textOverlayPosition}
            onSubmit={handleTextSubmit}
            onCancel={() => setTextInputPosition(null)}
            fontSize={fontSize * zoom}
            color={penColor}
            containerWidth={dimensions.width}
            containerHeight={dimensions.height}
            fontFamily={fontFamily}
          />
        )}
      </AnimatePresence>
    </div>
  );
}


