"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useWhiteboardStore } from "@/store/whiteboard";

export function PresenceBar() {
  const { users, userId } = useWhiteboardStore();
  const userList = Object.values(users);

  return (
    <div className="flex items-center gap-1">
      <AnimatePresence mode="popLayout">
        {userList.slice(0, 5).map((user) => (
          <motion.div
            key={user.userId}
            initial={{ opacity: 0, scale: 0.8, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: 10 }}
            transition={{ duration: 0.2 }}
            className="relative group"
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white border-2 ${
                user.userId === userId ? "border-(--primary)" : "border-transparent"
              }`}
              style={{ backgroundColor: user.color }}
              title={`${user.name}${user.role === "host" ? " (Host)" : ""}`}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            
            {/* Host crown */}
            {user.role === "host" && (
              <div className="absolute -top-1 -right-1 text-yellow-400 text-xs">
                👑
              </div>
            )}
            
            {/* Tooltip */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-(--surface) border border-(--border) rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {user.name}
              {user.role === "host" && <span className="text-yellow-400 ml-1">(Host)</span>}
              {user.userId === userId && <span className="text-(--primary) ml-1">(You)</span>}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      
      {userList.length > 5 && (
        <div className="w-8 h-8 rounded-full bg-(--surface-hover) border border-(--border) flex items-center justify-center text-xs text-(--text-muted)">
          +{userList.length - 5}
        </div>
      )}
      
      {userList.length === 0 && (
        <div className="text-xs text-(--text-muted)">
          No users
        </div>
      )}
    </div>
  );
}
