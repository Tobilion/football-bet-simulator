import { useState, useEffect } from "react";

export type ToastType = "goal" | "win" | "loss" | "cashout" | "transfer" | "info" | "tip";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number; // ms, default 4000
}

// ── Global singleton — call from anywhere without needing React ───────────────
let _toasts: Toast[] = [];
let _listeners: Array<(ts: Toast[]) => void> = [];
const _notify = () => _listeners.forEach((l) => l([..._toasts]));

export const addToast = (toast: Omit<Toast, "id">): void => {
  const id = Math.random().toString(36).slice(2, 9);
  if (_toasts.length >= 4) _toasts = _toasts.slice(1);
  _toasts = [..._toasts, { ...toast, id }];
  _notify();
  const dur = toast.duration ?? 4000;
  if (dur > 0) setTimeout(() => removeToast(id), dur);
};

export const removeToast = (id: string): void => {
  _toasts = _toasts.filter((t) => t.id !== id);
  _notify();
};

// ── Hook — subscribe a component to the global toast list ────────────────────
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([..._toasts]);

  useEffect(() => {
    const listener = (ts: Toast[]) => setToasts(ts);
    _listeners.push(listener);
    return () => {
      _listeners = _listeners.filter((l) => l !== listener);
    };
  }, []);

  return { toasts, addToast, removeToast };
}
