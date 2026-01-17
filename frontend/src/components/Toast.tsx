"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type ToastType = "join" | "leave" | "error";

export interface ToastMessage {
  id: string;
  type: ToastType;
  userName?: string;
  userColor?: string;
  message?: string; // For error messages
}

interface ToastProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export function ToastContainer({ toasts, removeToast }: ToastProps) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, toast.type === "error" ? 4000 : 3000);
    return () => clearTimeout(timer);
  }, [onDismiss, toast.type]);

  const isJoin = toast.type === "join";
  const isError = toast.type === "error";

  // Error toast
  if (isError) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: 50, scale: 0.9, filter: "blur(8px)" }}
        animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, x: 50, scale: 0.9, filter: "blur(8px)" }}
        transition={{ 
          type: "spring", 
          stiffness: 400, 
          damping: 30,
          filter: { duration: 0.2 }
        }}
        className="relative pointer-events-auto bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3 min-w-[260px] max-w-[360px]"
      >
        {/* Error icon */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-500/20 shrink-0">
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium">{toast.message}</p>
        </div>

        {/* Progress bar */}
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: 4, ease: "linear" }}
          className="absolute bottom-0 left-0 right-0 h-0.5 origin-left rounded-b-xl bg-red-500/50"
        />
      </motion.div>
    );
  }

  // Join/Leave toast
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50, scale: 0.9, filter: "blur(8px)" }}
      animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, x: 50, scale: 0.9, filter: "blur(8px)" }}
      transition={{ 
        type: "spring", 
        stiffness: 400, 
        damping: 30,
        filter: { duration: 0.2 }
      }}
      className="relative pointer-events-auto bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3 min-w-[220px]"
    >
      {/* User avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
        style={{ backgroundColor: toast.userColor || "#666" }}
      >
        {toast.userName?.charAt(0).toUpperCase() || "?"}
      </div>

      {/* Message */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{toast.userName}</p>
        <p className="text-xs text-[var(--text-muted)]">
          {isJoin ? "joined the room" : "left the room"}
        </p>
      </div>

      {/* Icon */}
      <div className={`shrink-0 ${isJoin ? "text-green-400" : "text-red-400"}`}>
        {isJoin ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        )}
      </div>

      {/* Progress bar */}
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: 3, ease: "linear" }}
        className={`absolute bottom-0 left-0 right-0 h-0.5 origin-left rounded-b-xl ${
          isJoin ? "bg-green-400/50" : "bg-red-400/50"
        }`}
      />
    </motion.div>
  );
}

// Hook to manage toasts
export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}
