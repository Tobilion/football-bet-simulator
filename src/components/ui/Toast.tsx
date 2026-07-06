import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Toast, removeToast, useToast } from "../../hooks/useToast";

const ICONS: Record<string, string> = {
  goal: "⚽",
  win: "💰",
  loss: "📊",
  cashout: "💸",
  transfer: "🔄",
  info: "💡",
  tip: "🎯",
};

// Left border accent colors matching variants
const BORDER_LEFT: Record<string, string> = {
  goal: "border-l-4 border-l-emerald-500",
  win: "border-l-4 border-l-emerald-500",
  loss: "border-l-4 border-l-red-500",
  cashout: "border-l-4 border-l-cyan-500",
  transfer: "border-l-4 border-l-purple-500",
  info: "border-l-4 border-l-blue-500",
  tip: "border-l-4 border-l-violet-500",
};

const ACCENT_COLOR: Record<string, string> = {
  goal: "#10b981",
  win: "#10b981",
  loss: "#ef4444",
  cashout: "#06b6d4",
  transfer: "#a855f7",
  info: "#3b82f6",
  tip: "#8b5cf6",
};

const TITLE_COLOR: Record<string, string> = {
  goal: "text-emerald-400",
  win: "text-emerald-400",
  loss: "text-red-400",
  cashout: "text-cyan-400",
  transfer: "text-purple-400",
  info: "text-blue-400",
  tip: "text-violet-400",
};

const ToastItem: React.FC<{ toast: Toast }> = ({ toast }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.9, x: 50 }}
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.85, x: 50, transition: { duration: 0.2 } }}
      onClick={() => removeToast(toast.id)}
      className={`
        flex items-start gap-3 px-4 py-3 rounded-r-xl border border-y-white/5 border-r-white/5 bg-[#12151c]/95 backdrop-blur-md
        cursor-pointer shadow-2xl pointer-events-auto w-80 relative overflow-hidden
        ${BORDER_LEFT[toast.type] ?? BORDER_LEFT.info}
      `}
    >
      <span className="text-xl leading-none shrink-0 mt-0.5">{ICONS[toast.type] ?? "💡"}</span>
      <div className="min-w-0 flex-1 pr-2 pb-1.5">
        <p className={`text-[11px] font-black font-mono uppercase tracking-wider ${TITLE_COLOR[toast.type] ?? TITLE_COLOR.info}`}>
          {toast.title}
        </p>
        <p className="text-[11px] text-slate-300 font-sans mt-0.5 leading-snug">
          {toast.message}
        </p>
      </div>
      <span className="text-slate-500 hover:text-slate-300 text-[10px] font-mono shrink-0 mt-0.5 transition-colors">✕</span>
      
      {/* Toast countdown progress line */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/5 overflow-hidden">
        <div
          className="h-full animate-toast-progress"
          style={{
            backgroundColor: ACCENT_COLOR[toast.type] ?? "var(--accent)",
            "--toast-duration": `${toast.duration ?? 3500}ms`,
          } as React.CSSProperties}
        />
      </div>
    </motion.div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts } = useToast();
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
};
