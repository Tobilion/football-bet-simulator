import React, { useEffect, useState } from "react";
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

const BORDER: Record<string, string> = {
  goal: "border-emerald-500/50 bg-emerald-500/10",
  win: "border-amber-500/50 bg-amber-500/10",
  loss: "border-red-500/40 bg-red-500/8",
  cashout: "border-sky-500/50 bg-sky-500/10",
  transfer: "border-purple-500/50 bg-purple-500/10",
  info: "border-slate-500/30 bg-slate-500/5",
  tip: "border-violet-500/50 bg-violet-500/10",
};

const TITLE_COLOR: Record<string, string> = {
  goal: "text-emerald-300",
  win: "text-amber-300",
  loss: "text-red-300",
  cashout: "text-sky-300",
  transfer: "text-purple-300",
  info: "text-slate-300",
  tip: "text-violet-300",
};

const ToastItem: React.FC<{ toast: Toast }> = ({ toast }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      onClick={() => removeToast(toast.id)}
      style={{ transition: "transform 0.28s ease, opacity 0.28s ease" }}
      className={`
        flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-md
        cursor-pointer shadow-2xl pointer-events-auto w-72 bg-[#080c12]
        ${BORDER[toast.type] ?? BORDER.info}
        ${visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
      `}
    >
      <span className="text-xl leading-none shrink-0 mt-0.5">{ICONS[toast.type] ?? "💡"}</span>
      <div className="min-w-0 flex-1">
        <p className={`text-[11px] font-black font-mono uppercase tracking-wider ${TITLE_COLOR[toast.type] ?? TITLE_COLOR.info}`}>
          {toast.title}
        </p>
        <p className="text-[11px] text-slate-400 font-sans mt-0.5 leading-snug">
          {toast.message}
        </p>
      </div>
      <span className="text-slate-600 text-[10px] font-mono shrink-0 mt-0.5">✕</span>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts } = useToast();
  return (
    <div className="fixed bottom-4 right-4 z-[300] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
};
