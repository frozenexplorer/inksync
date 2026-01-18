"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWhiteboardStore } from "@/store/whiteboard";
import { getSocket } from "@/lib/socket";
import { Tool } from "@/lib/types";
import { ClearBoardModal } from "./ClearBoardModal";

const COLORS = [
  "#000000", "#FFFFFF", "#FF6B6B", "#4ECDC4",
  "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD",
  "#F8B500", "#6C5CE7"
];

const THICKNESSES = [2, 4, 6, 10, 16];

type DockEdge = "left" | "right" | "top" | "bottom";

const DOCK_STORAGE_KEY = "inksync.toolbarDock";
const EDGE_PADDING = 10;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function Toolbar() {
  const [showSettings, setShowSettings] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [dockEdge, setDockEdge] = useState<DockEdge>(() => {
    if (typeof window === "undefined") return "left";
    const stored = window.localStorage.getItem(DOCK_STORAGE_KEY);
    if (stored === "left" || stored === "right" || stored === "top" || stored === "bottom") {
      return stored;
    }
    return "left";
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPositionState] = useState<{ x: number; y: number } | null>(null);
  const dragPositionRef = useRef<{ x: number; y: number } | null>(null);
  const dragStateRef = useRef<{
    offsetX: number;
    offsetY: number;
    containerRect: DOMRect;
    toolbarRect: DOMRect;
  } | null>(null);

  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isNarrow, setIsNarrow] = useState(false);

  const {
    tool,
    penColor,
    penThickness,
    role,
    showCursorCount,
    eraserMode,
    eraserSize,
    setTool,
    setPenColor,
    setPenThickness,
    setShowCursorCount,
    setEraserMode,
    setEraserSize,
  } = useWhiteboardStore();

  const isHorizontal = dockEdge === "top" || dockEdge === "bottom";
  const hasSize = containerSize.width > 0 && containerSize.height > 0;
  const longEdgesAreHorizontal = hasSize ? containerSize.width >= containerSize.height : true;
  const isShortEdge = hasSize ? (isHorizontal ? !longEdgesAreHorizontal : longEdgesAreHorizontal) : false;
  const isCompact = isShortEdge || isNarrow;

  const handleClearBoard = () => {
    if (role !== "host") return;
    setShowClearModal(true);
  };

  const handleConfirmClear = () => {
    getSocket().emit("board:clear");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DOCK_STORAGE_KEY, dockEdge);
  }, [dockEdge]);

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
  }, [dockEdge, isCompact]);

  useEffect(() => {
    if (isDragging) {
      setShowOptions(false);
      setShowSettings(false);
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

      const maxX = Math.max(0, state.containerRect.width - state.toolbarRect.width);
      const maxY = Math.max(0, state.containerRect.height - state.toolbarRect.height);
      const nextX = clamp(event.clientX - state.containerRect.left - state.offsetX, 0, maxX);
      const nextY = clamp(event.clientY - state.containerRect.top - state.offsetY, 0, maxY);
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

      const centerX = pos.x + state.toolbarRect.width / 2;
      const centerY = pos.y + state.toolbarRect.height / 2;
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
        return { left: 0, top: "50%", transform: "translateY(-50%)" };
      case "right":
        return { right: 0, top: "50%", transform: "translateY(-50%)" };
      case "top":
        return { top: EDGE_PADDING, left: "50%", transform: "translateX(-50%)" };
      case "bottom":
        return { bottom: EDGE_PADDING, left: "50%", transform: "translateX(-50%)" };
      default:
        return { left: 0, top: "50%", transform: "translateY(-50%)" };
    }
  }, [dockEdge]);

  const sizeStyle = useMemo<React.CSSProperties>(() => {
    const padding = EDGE_PADDING * 2;
    if (isHorizontal) {
      return { maxWidth: `calc(100% - ${padding}px)` };
    }
    return { maxHeight: `calc(100% - ${padding}px)` };
  }, [isHorizontal]);

  const dragStyle = dragPosition
    ? { left: 0, top: 0, transform: `translate3d(${dragPosition.x}px, ${dragPosition.y}px, 0)` }
    : dockStyle;

  const toolbarStyle = { ...dragStyle, ...sizeStyle };

  const optionsPanelPosition = useMemo(() => {
    switch (dockEdge) {
      case "left":
        return "left-full ml-2 top-0";
      case "right":
        return "right-full mr-2 top-0";
      case "top":
        return "top-full mt-2 left-0";
      case "bottom":
        return "bottom-full mb-2 left-0";
      default:
        return "left-full ml-2 top-0";
    }
  }, [dockEdge]);

  const dividerClass = isHorizontal ? "w-px h-8 bg-(--border)" : "w-full h-px bg-(--border)";
  const toolsClass = isHorizontal ? "flex items-center gap-1" : "flex flex-col gap-1";
  const toolButtonClass = isHorizontal ? "p-2" : "p-2 sm:p-3";
  const sectionLabelClass = isHorizontal ? "sr-only" : "text-[10px] text-(--text-muted) text-center uppercase tracking-wide";
  const swatchClass = isHorizontal ? "w-5 h-5" : "w-6 h-6";

  return (
    <motion.div
      ref={toolbarRef}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`absolute z-30 bg-(--surface) border border-(--border) shadow-xl ${
        isHorizontal ? "flex flex-row items-center gap-2 px-2 py-2" : "flex flex-col gap-2 p-2"
      } ${isCompact ? "rounded-xl" : "rounded-2xl"} ${isDragging ? "ring-2 ring-(--primary)/40" : "transition-shadow"}`}
      style={toolbarStyle}
    >
      <button
        type="button"
        onPointerDown={startDrag}
        className={`text-(--text-muted) hover:text-white hover:bg-(--surface-hover) rounded-lg ${
          isHorizontal ? "px-2 py-1" : "p-2"
        } cursor-grab active:cursor-grabbing`}
        aria-label="Move toolbar"
        style={{ touchAction: "none" }}
      >
        <span
          className={`grid ${
            isHorizontal ? "grid-flow-col grid-rows-2" : "grid-cols-2"
          } gap-0.5`}
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} className="h-1 w-1 rounded-full bg-current opacity-60" />
          ))}
        </span>
      </button>

      <div
        className={`flex ${
          isHorizontal ? "items-center flex-wrap gap-2" : "flex-col gap-2 flex-1 min-h-0 overflow-y-auto"
        }`}
      >
        <div className={toolsClass}>
          {[
            { id: "pen", label: "Pen", icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            )},
            { id: "eraser", label: "Eraser", icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21M22 21H7M5 11l9 9" />
              </svg>
            )},
            { id: "text", label: "Text", icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            )},
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id as Tool)}
              className={`${toolButtonClass} rounded-xl transition-all duration-150 cursor-pointer flex items-center justify-center ${
                tool === t.id
                  ? "bg-(--primary) text-black"
                  : "hover:bg-(--surface-hover) text-(--text-muted) hover:text-white"
              }`}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
        </div>

        {!isCompact && (
          <>
            {tool === "eraser" ? (
              <>
                <div className={dividerClass} />
                <div className={`flex ${isHorizontal ? "items-center gap-3" : "flex-col gap-2"}`}>
                  <span className={sectionLabelClass}>Eraser Type</span>
                  <div className={`flex ${isHorizontal ? "items-center gap-2" : "flex-col gap-2"}`}>
                    <button
                      onClick={() => setEraserMode("stroke")}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all ${
                        eraserMode === "stroke"
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
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all ${
                        eraserMode === "pixel"
                          ? "bg-(--primary) text-black"
                          : "hover:bg-(--surface-hover) text-(--text-muted)"
                      }`}
                      title="Pixel Eraser - Erases parts of strokes"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
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
            ) : (
              <div className={dividerClass} />
            )}

            <div className={`flex ${isHorizontal ? "items-center gap-2" : "flex-col gap-1.5"}`}>
              <span className={sectionLabelClass}>Color</span>
              <div className={`flex flex-wrap gap-1 ${isHorizontal ? "max-w-[220px]" : ""}`}>
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setPenColor(color)}
                    className={`${swatchClass} rounded-lg transition-transform duration-150 hover:scale-110 ${
                      penColor === color ? "ring-2 ring-(--primary) ring-offset-2 ring-offset-(--surface)" : ""
                    }`}
                    style={{
                      backgroundColor: color,
                      border: color === "#FFFFFF" ? "1px solid var(--border)" : "none"
                    }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            <div className={dividerClass} />

            <div className={`flex ${isHorizontal ? "items-center gap-2" : "flex-col gap-1.5"}`}>
              <span className={sectionLabelClass}>Size</span>
              <div className={`flex ${isHorizontal ? "items-center gap-2" : "flex-col gap-1 items-center"}`}>
                {THICKNESSES.map((thickness) => (
                  <button
                    key={thickness}
                    onClick={() => setPenThickness(thickness)}
                    className={`p-1.5 rounded-lg flex items-center justify-center transition-all duration-150 ${
                      penThickness === thickness
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

            {role === "host" && (
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

            <div className={dividerClass} />

            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-xl transition-all duration-150 flex items-center justify-center w-full ${
                  showSettings
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
                    <label className="flex items-center justify-between gap-3 cursor-pointer group">
                      <span className="text-sm text-(--text-muted) group-hover:text-white transition-colors">
                        Show cursor count
                      </span>
                      <button
                        onClick={() => setShowCursorCount(!showCursorCount)}
                        className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${
                          showCursorCount ? "bg-(--primary)" : "bg-(--surface-hover)"
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}

        {isCompact && (
          <>
            {role === "host" && (
              <button
                onClick={handleClearBoard}
                className="p-2 rounded-xl text-red-400 hover:bg-red-500/20 transition-colors"
                title="Clear Board (Host only)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <button
              onClick={() => setShowOptions(!showOptions)}
              className={`p-2 rounded-xl transition-all duration-150 ${
                showOptions
                  ? "bg-(--primary) text-black"
                  : "hover:bg-(--surface-hover) text-(--text-muted) hover:text-white"
              }`}
              title="Options"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
              </svg>
            </button>
          </>
        )}
      </div>

      <AnimatePresence>
        {isCompact && showOptions && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className={`absolute ${optionsPanelPosition} bg-(--surface) border border-(--border) rounded-xl p-4 shadow-2xl w-[260px]`}
          >
            <div className="flex flex-col gap-3">
              {tool === "eraser" && (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] text-(--text-muted) uppercase tracking-wide">Eraser Type</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEraserMode("stroke")}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all ${
                        eraserMode === "stroke"
                          ? "bg-(--primary) text-black"
                          : "hover:bg-(--surface-hover) text-(--text-muted)"
                      }`}
                    >
                      Stroke
                    </button>
                    <button
                      onClick={() => setEraserMode("pixel")}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all ${
                        eraserMode === "pixel"
                          ? "bg-(--primary) text-black"
                          : "hover:bg-(--surface-hover) text-(--text-muted)"
                      }`}
                    >
                      Pixel
                    </button>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-(--text-muted) uppercase tracking-wide">Size: {eraserSize}px</span>
                    <input
                      type="range"
                      min="2"
                      max="50"
                      value={eraserSize}
                      onChange={(e) => setEraserSize(Number(e.target.value))}
                      className="w-full h-1.5 bg-(--surface-hover) rounded-full appearance-none cursor-pointer accent-(--primary)"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-(--text-muted) uppercase tracking-wide">Color</span>
                <div className="flex flex-wrap gap-1">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setPenColor(color)}
                      className="w-6 h-6 rounded-lg transition-transform duration-150 hover:scale-110"
                      style={{
                        backgroundColor: color,
                        border: color === "#FFFFFF" ? "1px solid var(--border)" : "none"
                      }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-(--text-muted) uppercase tracking-wide">Size</span>
                <div className="flex items-center gap-2">
                  {THICKNESSES.map((thickness) => (
                    <button
                      key={thickness}
                      onClick={() => setPenThickness(thickness)}
                      className={`p-1.5 rounded-lg flex items-center justify-center transition-all duration-150 ${
                        penThickness === thickness
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

              <label className="flex items-center justify-between gap-3 cursor-pointer group">
                <span className="text-sm text-(--text-muted) group-hover:text-white transition-colors">
                  Show cursor count
                </span>
                <button
                  onClick={() => setShowCursorCount(!showCursorCount)}
                  className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${
                    showCursorCount ? "bg-(--primary)" : "bg-(--surface-hover)"
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clear Board Confirmation Modal */}
      <ClearBoardModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleConfirmClear}
      />
    </motion.div>
  );
}
