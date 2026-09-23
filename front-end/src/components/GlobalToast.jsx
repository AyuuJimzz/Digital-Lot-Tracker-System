import React, { useState, useEffect, useCallback } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

// Global Safety Net: Intercept native window.alert immediately at module evaluation
// so ugly browser modal dialogs NEVER appear anywhere in the entire app.
if (typeof window !== "undefined" && !window.__alert_toast_intercepted) {
  window.__alert_toast_intercepted = true;
  window.alert = (msg) => {
    const text = String(msg ?? "");
    if (!text.trim()) return;
    const isError = /error|fail|cannot|denied|invalid/i.test(text);
    const isWarning = /please|must|select|ensure|warn|attention/i.test(text);
    const isSuccess = /success|created|updated|saved|✅|active/i.test(text);
    const type = isError ? "error" : isWarning ? "warning" : isSuccess ? "success" : "info";
    showToast(text, type, 4500);
  };
}

/**
 * Dispatch an app-wide floating toast notification.
 * @param {string} message
 * @param {"success"|"error"|"warning"|"info"} [type="success"]
 * @param {number} [duration=4000]
 */
export function showToast(message, type = "success", duration = 4000) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("appToast", {
        detail: { id: Date.now() + Math.random(), message, type, duration },
      })
    );
  }
}

export default function GlobalToast() {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const handleToastEvent = (e) => {
      const { id, message, type = "success", duration = 4000 } = e.detail || {};
      if (!message) return;
      const newToast = { id: id || (Date.now() + Math.random()), message, type };
      setToasts((prev) => [...prev.slice(-3), newToast]); // Keep max 4 visible

      if (duration > 0) {
        setTimeout(() => {
          removeToast(newToast.id);
        }, duration);
      }
    };

    window.addEventListener("appToast", handleToastEvent);
    return () => {
      window.removeEventListener("appToast", handleToastEvent);
    };
  }, [removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[999999] flex flex-col gap-3 pointer-events-none max-w-sm sm:max-w-md w-full px-4 sm:px-0"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const isError = toast.type === "error";
        const isWarning = toast.type === "warning";
        const isInfo = toast.type === "info";
        const isSuccess = !isError && !isWarning && !isInfo;

        const badgeClasses = isError
          ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
          : isWarning
          ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
          : isInfo
          ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
          : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400";

        const titleText = isError ? "Error" : isWarning ? "Notice" : isInfo ? "Info" : "Success";
        const titleColor = isError
          ? "text-rose-400"
          : isWarning
          ? "text-amber-400"
          : isInfo
          ? "text-blue-400"
          : "text-emerald-400";

        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3.5 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-700/80 dark:border-slate-700 text-white rounded-2xl p-4 shadow-2xl shadow-black/50 transition-all animate-in slide-in-from-bottom-5 fade-in duration-200"
          >
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${badgeClasses}`}>
              {isError && <XCircle className="w-5 h-5" />}
              {isWarning && <AlertTriangle className="w-5 h-5" />}
              {isInfo && <Info className="w-5 h-5" />}
              {isSuccess && <CheckCircle2 className="w-5 h-5" />}
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${titleColor}`}>
                {titleText}
              </div>
              <div className="text-sm font-medium text-slate-100 leading-snug break-words">
                {toast.message}
              </div>
            </div>

            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
