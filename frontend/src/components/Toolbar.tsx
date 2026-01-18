"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWhiteboardStore } from "@/store/whiteboard";
import { getSocket } from "@/lib/socket";
import { Tool, ShapeType } from "@/lib/types";
import { ClearBoardModal } from "./ClearBoardModal";
import { handleKeyboardShortcut, SHORTCUTS, getShortcutLabel } from "@/lib/toolbarShortcuts";

const COLORS = [
  // Blacks & Grays
  "#000000", "#1a1a1a", "#404040", "#666666", "#999999", "#cccccc", "#e5e5e5", "#ffffff",
  // Reds
  "#ff0000", "#ff4444", "#ff6b6b", "#ff8a80", "#ffcdd2", "#8b0000", "#c62828", "#d32f2f",
  // Pinks & Purples
  "#ff1493", "#ff69b4", "#ffc0cb", "#dda0dd", "#da70d6", "#ba55d3", "#9370db", "#8b008b",
  // Blues
  "#0000ff", "#1e90ff", "#4169e1", "#4682b4", "#5f9ea0", "#00bfff", "#87ceeb", "#add8e6",
  // Cyans & Teals
  "#00ffff", "#00ced1", "#20b2aa", "#48d1cc", "#40e0d0", "#4ecdc4", "#7fdbff", "#b0e0e6",
  // Greens
  "#00ff00", "#32cd32", "#00fa9a", "#90ee90", "#98fb98", "#8fbc8f", "#3cb371", "#2e8b57",
  // Yellows & Oranges
  "#ffff00", "#ffd700", "#ffa500", "#ff8c00", "#ff7f50", "#ff6347", "#ffeaa7", "#f8b500",
  // Browns & Earth Tones
  "#8b4513", "#a0522d", "#d2691e", "#cd853f", "#deb887", "#f4a460", "#bc8f8f", "#d2b48c",
];

const THICKNESSES = [2, 4, 6, 10, 16];

type DockEdge = "left" | "right" | "top" | "bottom";

const DOCK_STORAGE_KEY = "inksync.toolbarDock";
const COLLAPSE_STORAGE_KEY = "inksync.toolbarCollapsed";
const DRAG_BUFFER = 80;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// Tool configurations with proper icons
const toolConfigs: Array<{ id: Tool; label: string; icon: JSX.Element }> = [
  {
    id: "hand",
    label: "Hand",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
      </svg>
    )
  },
  {
    id: "pen",
    label: "Pen",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    )
  },
  {
    id: "highlighter",
    label: "Highlighter",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19l-7 2 2-7m5 5l9-9m0 0l-4-4m4 4l4-4m-13 5l4-4M7 7l12-5" opacity="0.6" />
      </svg>
    )
  },
  {
    id: "eraser",
    label: "Eraser",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21M22 21H7M5 11l9 9" />
      </svg>
    )
  },
  {
    id: "shape",
    label: "Shapes",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="4" y="4" width="16" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
      </svg>
    )
  },
  {
    id: "text",
    label: "Text",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 4h12M12 4v16m-6 0h12" />
      </svg>
    )
  },
  {
    id: "sticky",
    label: "Sticky",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    id: "laser",
    label: "Laser",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    )
  },
  {
    id: "image",
    label: "Image",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  },
];

const shapeIcons: Record<ShapeType, JSX.Element> = {
  rectangle: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="4" y="6" width="16" height="12" rx="1" strokeWidth={2} />
    </svg>
  ),
  ellipse: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <ellipse cx="12" cy="12" rx="8" ry="6" strokeWidth={2} />
    </svg>
  ),
  line: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <line x1="4" y1="20" x2="20" y2="4" strokeWidth={2} strokeLinecap="round" />
    </svg>
  ),
  arrow: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M4 20L20 4M20 4L14 4M20 4L20 10" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export function Toolbar() {
  const [showSettings, setShowSettings] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [dockEdge, setDockEdge] = useState<DockEdge>(() => {
    if (typeof window === "undefined") return "bottom";
    const stored = window.localStorage.getItem(DOCK_STORAGE_KEY);
    if (stored === "left" || stored === "right" || stored === "top" || stored === "bottom") {
      return stored;
    }
    return "bottom";
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPositionState] = useState<{ x: number; y: number } | null>(null);
  const dragPositionRef = useRef<{ x: number; y: number } | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const dragStateRef = useRef<{
    offsetX: number;
    offsetY: number;
    containerRect: DOMRect;
    toolbarRect: DOMRect;
  } | null>(null);

  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isNarrow, setIsNarrow] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>(() => {
    if (typeof window === "undefined") return ["#000000", "#FF6B6B", "#4ECDC4"];
    const stored = window.localStorage.getItem("inksync.recentColors");
    return stored ? JSON.parse(stored) : ["#000000", "#FF6B6B", "#4ECDC4"];
  });
  const colorPickerRef = useRef<HTMLInputElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true";
  });

  const {
    tool,
    penColor,
    penThickness,
    role,
    showCursorCount,
    eraserMode,
    eraserSize,
    opacity,
    fill,
    shapeType,
    setTool,
    setPenColor,
    setPenThickness,
    setShowCursorCount,
    setEraserMode,
    setEraserSize,
    setOpacity,
    setFill,
    setShapeType,
  } = useWhiteboardStore();

  const isHorizontal = dockEdge === "top" || dockEdge === "bottom";
  const hasSize = containerSize.width > 0 && containerSize.height > 0;
  const longEdgesAreHorizontal = hasSize ? containerSize.width >= containerSize.height : true;
  const isShortEdge = hasSize ? (isHorizontal ? !longEdgesAreHorizontal : longEdgesAreHorizontal) : false;
  const forceCompact = isShortEdge || isNarrow;
  const collapsed = forceCompact || isCollapsed;

  const handleClearBoard = () => {
    if (role !== "host") return;
    setShowClearModal(true);
  };

  const handleConfirmClear = () => {
    getSocket().emit("board:clear");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Handle image upload - emit to socket or add to store
      console.log("Image uploaded:", file.name);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const handled = handleKeyboardShortcut(e, {
        onToolSelect: setTool,
        onZoomIn: () => { }, // noop
        onZoomOut: () => { }, // noop
        onFit: () => { }, // noop
        onToggleExpand: () => setIsCollapsed(prev => !prev),
      });

      if (handled) {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setTool]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DOCK_STORAGE_KEY, dockEdge);
  }, [dockEdge]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsNarrow(window.innerWidth < 640);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const container = toolbarRef.current?.parentElement;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    setShowOptions(false);
  }, [dockEdge, collapsed]);

  useEffect(() => {
    if (collapsed) {
      setShowSettings(false);
      setShowShapeMenu(false);
    }
  }, [collapsed]);

  useEffect(() => {
    if (isDragging) {
      setShowOptions(false);
      setShowSettings(false);
      setShowShapeMenu(false);
    }
  }, [isDragging]);

  const updateDragPosition = useCallback((pos: { x: number; y: number } | null) => {
    dragPositionRef.current = pos;
    setDragPositionState(pos);
  }, []);

  const startDrag = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!toolbarRef.current) return;
    const container = toolbarRef.current.parentElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const toolbarRect = toolbarRef.current.getBoundingClientRect();

    dragStateRef.current = {
      offsetX: event.clientX - toolbarRect.left,
      offsetY: event.clientY - toolbarRect.top,
      containerRect,
      toolbarRect,
    };

    lastPointerRef.current = {
      x: event.clientX - containerRect.left,
      y: event.clientY - containerRect.top,
    };

    updateDragPosition({
      x: toolbarRect.left - containerRect.left,
      y: toolbarRect.top - containerRect.top,
    });

    setIsDragging(true);
    event.preventDefault();
    event.stopPropagation();
  }, [updateDragPosition]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (event: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state) return;

      const pointerX = event.clientX - state.containerRect.left;
      const pointerY = event.clientY - state.containerRect.top;
      lastPointerRef.current = { x: pointerX, y: pointerY };

      const maxX = Math.max(0, state.containerRect.width - state.toolbarRect.width);
      const maxY = Math.max(0, state.containerRect.height - state.toolbarRect.height);
      const bufferX = Math.min(DRAG_BUFFER, state.containerRect.width * 0.15);
      const bufferY = Math.min(DRAG_BUFFER, state.containerRect.height * 0.15);
      const nextX = clamp(pointerX - state.offsetX, -bufferX, maxX + bufferX);
      const nextY = clamp(pointerY - state.offsetY, -bufferY, maxY + bufferY);
      updateDragPosition({ x: nextX, y: nextY });
    };

    const handleUp = () => {
      const state = dragStateRef.current;
      const pos = dragPositionRef.current;
      if (!state || !pos) {
        setIsDragging(false);
        updateDragPosition(null);
        return;
      }

      const pointer = lastPointerRef.current ?? {
        x: pos.x + state.toolbarRect.width / 2,
        y: pos.y + state.toolbarRect.height / 2,
      };
      const centerX = clamp(pointer.x, 0, state.containerRect.width);
      const centerY = clamp(pointer.y, 0, state.containerRect.height);
      const distances = {
        left: centerX,
        right: state.containerRect.width - centerX,
        top: centerY,
        bottom: state.containerRect.height - centerY,
      };

      const nextDock = (Object.keys(distances) as DockEdge[]).reduce((closest, edge) => {
        return distances[edge] < distances[closest] ? edge : closest;
      }, "left");

      setDockEdge(nextDock);
      setIsDragging(false);
      updateDragPosition(null);
      dragStateRef.current = null;
      lastPointerRef.current = null;
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [isDragging, updateDragPosition]);

  const dockStyle = useMemo<React.CSSProperties>(() => {
    switch (dockEdge) {
      case "left":
        return { left: 0, top: 0, bottom: 0 };
      case "right":
        return { right: 0, top: 0, bottom: 0 };
      case "top":
        return { top: 0, left: 0, right: 0 };
      case "bottom":
        return { bottom: 0, left: 0, right: 0 };
      default:
        return { left: 0, top: 0, bottom: 0 };
    }
  }, [dockEdge]);

  const sizeStyle = useMemo<React.CSSProperties>(() => {
    if (isHorizontal) {
      return { width: "100%", height: "auto" };
    }
    return {
      height: "100%",
      width: collapsed ? "min(180px, 75vw)" : "min(240px, 80vw)",
    };
  }, [isHorizontal, collapsed]);

  const dragStyle = dragPosition
    ? { left: 0, top: 0, transform: `translate3d(${dragPosition.x}px, ${dragPosition.y}px, 0)` }
    : dockStyle;

  const toolbarStyle = { ...dragStyle, ...sizeStyle };

  const optionsPanelPosition = "bottom-full mb-3 left-4";

  const dividerClass = isHorizontal ? "w-px h-6 bg-(--border)" : "w-full h-px bg-(--border)";
  const toolsClass = isHorizontal ? "flex items-center gap-0.5" : "flex flex-col gap-1";
  const toolButtonClass = isHorizontal ? "p-1.5" : "p-2 sm:p-2.5";
  const sectionLabelClass = isHorizontal ? "sr-only" : "text-[10px] text-(--text-muted) text-center uppercase tracking-wide";
  const swatchClass = isHorizontal ? "w-4 h-4" : "w-5 h-5";

  const visibleTools = collapsed
    ? toolConfigs.filter((t) => t.id === "pen")
    : toolConfigs.filter((t) => ["pen", "eraser", "text", "pan", "shape"].includes(t.id));

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-center p-3 pointer-events-none">
        <motion.div
          ref={toolbarRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-(--surface)/95 backdrop-blur-xl border border-(--border) shadow-2xl flex flex-row items-center gap-1.5 px-3 py-2 rounded-xl pointer-events-auto`}
        >
          {!forceCompact && (
            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="text-(--text-muted) hover:text-white hover:bg-(--surface-hover) rounded-md px-1.5 py-1"
              aria-label={collapsed ? "Expand toolbar" : "Collapse toolbar"}
            >
              {collapsed ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
                </svg>
              )}
            </button>
          )}

          <div className="flex items-center gap-1 flex-1 justify-center max-w-screen-lg">
            <div className={toolsClass}>
              {visibleTools.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTool(t.id)}
                  className={`${toolButtonClass} rounded-lg transition-all duration-150 cursor-pointer flex items-center justify-center ${tool === t.id
                    ? "bg-(--primary) text-black"
                    : "hover:bg-(--surface-hover) text-(--text-muted) hover:text-white"
                    }`}
                  title={t.label}
                >
                  {t.icon}
                </button>
              ))}
            </div>

            <div className={dividerClass} />

            {!collapsed && tool === "eraser" && (
              <>
                <div className={`flex ${isHorizontal ? "items-center gap-3" : "flex-col gap-2"}`}>
                  <span className={sectionLabelClass}>Eraser Type</span>
                  <div className={`flex ${isHorizontal ? "items-center gap-2" : "flex-col gap-2"}`}>
                    <button
                      onClick={() => setEraserMode("stroke")}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all ${eraserMode === "stroke"
                        ? "bg-(--primary) text-black"
                        : "hover:bg-(--surface-hover) text-(--text-muted)"
                        }`}
                      title="Stroke Eraser - Deletes entire strokes"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Stroke</span>
                    </button>
                    <button
                      onClick={() => setEraserMode("pixel")}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all ${eraserMode === "pixel"
                        ? "bg-(--primary) text-black"
                        : "hover:bg-(--surface-hover) text-(--text-muted)"
                        }`}
                      title="Pixel Eraser - Erases parts of strokes"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14v7" />
                      </svg>
                      <span>Pixel</span>
                    </button>
                  </div>
                  <div className={`flex ${isHorizontal ? "items-center gap-2" : "flex-col gap-1"}`}>
                    <span className={sectionLabelClass}>Size: {eraserSize}px</span>
                    <input
                      type="range"
                      min="2"
                      max="50"
                      value={eraserSize}
                      onChange={(e) => setEraserSize(Number(e.target.value))}
                      className={`${isHorizontal ? "w-24" : "w-full"} h-1.5 bg-(--surface-hover) rounded-full appearance-none cursor-pointer accent-(--primary)`}
                    />
                  </div>
                </div>
                <div className={dividerClass} />
              </>
            )}

            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {recentColors.map((color, index) => (
                    <button
                      key={color + index}
                      onClick={() => {
                        setPenColor(color);
                        setShowColorPicker(false);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setEditingSlot(index);
                        setShowColorPicker(true);
                      }}
                      className={`${swatchClass} rounded-lg transition-all duration-150 hover:scale-110 ${penColor === color ? "ring-2 ring-(--primary) ring-offset-1 ring-offset-(--surface)" : ""
                        }`}
                      style={{
                        backgroundColor: color,
                        border: color === "#FFFFFF" ? "1px solid var(--border)" : "none"
                      }}
                      title={`${color} (Right-click to change)`}
                    />
                  ))}
                  <button
                    onClick={() => {
                      setEditingSlot(null);
                      setShowColorPicker(!showColorPicker);
                    }}
                    className={`${swatchClass} rounded-lg border-2 border-dashed border-(--border) hover:border-(--primary) transition-all duration-150 flex items-center justify-center hover:scale-110 ${showColorPicker ? "border-(--primary) bg-(--primary)/10" : ""
                      }`}
                    title="Open color palette"
                  >
                    <svg className="w-3 h-3 text-(--text-muted)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Color Picker Palette */}
              <AnimatePresence>
                {showColorPicker && (
                  <>
                    {/* Backdrop to close picker */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => {
                        setShowColorPicker(false);
                        setEditingSlot(null);
                      }}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="fixed left-1/2 -translate-x-1/2 bg-(--surface)/98 backdrop-blur-xl border border-(--border) rounded-xl p-4 shadow-2xl z-50"
                      style={{
                        width: "580px",
                        maxWidth: "90vw",
                        bottom: "80px" // Position just above the toolbar
                      }}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-white">
                            {editingSlot !== null ? `✏️ Edit Preset ${editingSlot + 1}` : "🎨 Choose Color"}
                          </span>
                          <button
                            onClick={() => {
                              setShowColorPicker(false);
                              setEditingSlot(null);
                            }}
                            className="text-(--text-muted) hover:text-white p-1 hover:bg-(--surface-hover) rounded transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        {editingSlot !== null && (
                          <div className="text-xs text-(--text-muted) bg-(--primary)/10 border border-(--primary)/20 px-3 py-2 rounded-lg">
                            💡 Click any color to save it to Preset {editingSlot + 1}
                          </div>
                        )}

                        {/* Color Palette Grid - Wider layout */}
                        <div className="grid grid-cols-16 gap-2">
                          {COLORS.map((color) => (
                            <button
                              key={color}
                              onClick={() => {
                                if (editingSlot !== null) {
                                  const updated = [...recentColors];
                                  updated[editingSlot] = color;
                                  setRecentColors(updated);
                                  if (typeof window !== "undefined") {
                                    window.localStorage.setItem("inksync.recentColors", JSON.stringify(updated));
                                  }
                                  setEditingSlot(null);
                                }
                                setPenColor(color);
                                if (editingSlot === null) setShowColorPicker(false);
                              }}
                              className={`w-8 h-8 rounded-lg transition-all duration-150 hover:scale-125 hover:shadow-lg ${penColor === color ? "ring-2 ring-(--primary) ring-offset-2 ring-offset-(--surface) scale-110" : ""
                                }`}
                              style={{
                                backgroundColor: color,
                                border: color === "#ffffff" || color === "#e5e5e5" ? "1px solid var(--border)" : "none"
                              }}
                              title={color}
                            />
                          ))}
                        </div>

                        {/* Custom Color Input */}
                        <div className="flex flex-col gap-2 pt-2 border-t border-(--border)">
                          <span className="text-xs font-medium text-(--text-muted)">Custom Color</span>
                          <div className="flex items-center gap-2">
                            <input
                              ref={colorPickerRef}
                              type="color"
                              value={penColor}
                              onChange={(e) => {
                                const newColor = e.target.value;
                                if (editingSlot !== null) {
                                  const updated = [...recentColors];
                                  updated[editingSlot] = newColor;
                                  setRecentColors(updated);
                                  if (typeof window !== "undefined") {
                                    window.localStorage.setItem("inksync.recentColors", JSON.stringify(updated));
                                  }
                                  setEditingSlot(null);
                                }
                                setPenColor(newColor);
                                if (editingSlot === null) setShowColorPicker(false);
                              }}
                              className="w-full h-10 rounded-lg cursor-pointer border border-(--border)"
                            />
                            <div className="flex flex-col items-end">
                              <span className="text-xs text-(--text-muted) uppercase font-mono">{penColor}</span>
                              <span className="text-[10px] text-(--text-muted)/60">HEX</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}    </AnimatePresence>
            </div>


            {tool === "pen" && (
              <>
                <div className={dividerClass} />

                <div className={`flex ${isHorizontal ? "items-center gap-2" : "flex-col gap-1.5"}`}>
                  <span className={sectionLabelClass}>Size</span>
                  <div className={`flex ${isHorizontal ? "items-center gap-2" : "flex-col gap-1 items-center"}`}>
                    {THICKNESSES.map((thickness) => (
                      <button
                        key={thickness}
                        onClick={() => setPenThickness(thickness)}
                        className={`p-1.5 rounded-lg flex items-center justify-center transition-all duration-150 ${penThickness === thickness
                          ? "bg-(--primary) opacity-20"
                          : "hover:bg-(--surface-hover)"
                          }`}
                        title={`${thickness}px`}
                      >
                        <div
                          className="rounded-full bg-white"
                          style={{
                            width: `${Math.min(thickness + 4, 20)}px`,
                            height: `${Math.min(thickness + 4, 20)}px`
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}


            {!collapsed && tool === "shape" && (
              <>
                <div className={dividerClass} />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-(--text-muted)">Fill</span>
                  <button
                    onClick={() => setFill(!fill)}
                    className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${fill ? "bg-(--primary)" : "bg-(--surface-hover)"
                      }`}
                  >
                    <motion.div
                      initial={false}
                      animate={{ x: fill ? 16 : 2 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>
              </>
            )}


            {!collapsed && role === "host" && (
              <>
                <div className={dividerClass} />
                <button
                  onClick={handleClearBoard}
                  className="p-2 rounded-xl text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center"
                  title="Clear Board"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}

            {!collapsed && (
              <>
                <div className={dividerClass} />

                <div className="relative">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`p-2 rounded-xl transition-all duration-150 flex items-center justify-center w-full ${showSettings
                      ? "bg-(--primary) text-black"
                      : "hover:bg-(--surface-hover) text-(--text-muted) hover:text-white"
                      }`}
                    title="Settings"
                  >
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>

                  <AnimatePresence>
                    {showSettings && (
                      <motion.div
                        initial={{ opacity: 0, x: -10, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute ${optionsPanelPosition} bg-(--surface) border border-(--border) rounded-xl p-4 shadow-xl min-w-[200px]`}
                      >
                        <h3 className="text-sm font-semibold mb-3 text-white">Settings</h3>
                        <label className="flex items-center justify-between gap-3 cursor-pointer group mb-3">
                          <span className="text-sm text-(--text-muted) group-hover:text-white transition-colors">
                            Show cursor count
                          </span>
                          <button
                            onClick={() => setShowCursorCount(!showCursorCount)}
                            className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${showCursorCount ? "bg-(--primary)" : "bg-(--surface-hover)"
                              }`}
                          >
                            <motion.div
                              initial={false}
                              animate={{ x: showCursorCount ? 16 : 2 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                            />
                          </button>
                        </label>
                        <button
                          onClick={() => {
                            setShowShortcuts(true);
                            setShowSettings(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-(--surface-hover) transition-colors text-left text-sm text-(--text-muted) hover:text-white"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span>Keyboard Shortcuts</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}

            {collapsed && (
              <>
                <div className={dividerClass} />
                <button
                  onClick={() => setShowOptions(!showOptions)}
                  className={`p-2 rounded-xl transition-all duration-150 ${showOptions
                    ? "bg-(--primary) text-black"
                    : "hover:bg-(--surface-hover) text-(--text-muted) hover:text-white"
                    }`}
                  title="More options"
                  aria-expanded={showOptions}
                  aria-haspopup="dialog"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {!collapsed && tool === "shape" && (
            <>
              <div className={dividerClass} />
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {(Object.keys(shapeIcons) as ShapeType[]).map((shape) => (
                    <button
                      key={shape}
                      onClick={() => setShapeType(shape)}
                      className={`p-2 rounded-lg transition-all ${shapeType === shape
                        ? "bg-(--primary) text-black"
                        : "hover:bg-(--surface-hover) text-(--text-muted)"
                        }`}
                      title={shape.charAt(0).toUpperCase() + shape.slice(1)}
                    >
                      {shapeIcons[shape]}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <AnimatePresence>
            {collapsed && showOptions && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowOptions(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute ${optionsPanelPosition} bg-(--surface) border border-(--border) rounded-xl p-4 shadow-2xl w-[280px] max-w-[80vw] z-50`}
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] text-(--text-muted) uppercase tracking-wide">Tools</span>
                      <div className="flex flex-wrap gap-2">
                        {toolConfigs.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setTool(t.id);
                              if (t.id === "image" && fileInputRef.current) {
                                fileInputRef.current.click();
                              }
                              setShowOptions(false);
                            }}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all ${tool === t.id
                              ? "bg-(--primary) text-black"
                              : "hover:bg-(--surface-hover) text-(--text-muted)"
                              }`}
                            title={t.label}
                          >
                            {t.icon}
                            <span>{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {role === "host" && (
                      <button
                        onClick={() => {
                          handleClearBoard();
                          setShowOptions(false);
                        }}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Clear board</span>
                      </button>
                    )}

                    <label className="flex items-center justify-between gap-3 cursor-pointer group">
                      <span className="text-sm text-(--text-muted) group-hover:text-white transition-colors">
                        Show cursor count
                      </span>
                      <button
                        onClick={() => setShowCursorCount(!showCursorCount)}
                        className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${showCursorCount ? "bg-(--primary)" : "bg-(--surface-hover)"
                          }`}
                      >
                        <motion.div
                          className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white"
                          animate={{ x: showCursorCount ? 16 : 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </label>

                    <button
                      onClick={() => {
                        setShowShortcuts(true);
                        setShowOptions(false);
                      }}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-(--text-muted) hover:bg-(--surface-hover) hover:text-white transition-all w-full"
                    >
                      <span>Keyboard shortcuts</span>
                      <span className="opacity-50">?</span>
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Keyboard shortcuts modal - Moved outside main container */}
      {
        showShortcuts && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
            onClick={() => setShowShortcuts(false)}
          >
            <div
              className="bg-(--surface) rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl border border-(--border)"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold mb-4 text-white">Keyboard Shortcuts</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {SHORTCUTS.map((shortcut, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-(--border)">
                    <span className="text-sm text-(--text)">{shortcut.description}</span>
                    <kbd className="px-2 py-1 bg-(--surface-hover) rounded text-xs font-mono text-(--text-muted)">
                      {getShortcutLabel(shortcut)}
                    </kbd>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="mt-4 w-full py-2 bg-(--primary) text-black rounded-lg hover:bg-(--primary-hover) transition-colors font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        )
      }

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Clear Board Confirmation Modal */}
      <ClearBoardModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleConfirmClear}
      />
    </>
  );
}
