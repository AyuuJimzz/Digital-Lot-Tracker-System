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

      setToasts((prev) => {
        // Anti-spam deduplication: If identical message already exists, dismiss older one
        const filtered = prev.filter((t) => t.message !== message);
        // Keep at most 2 toasts visible so screen isn't cluttered
        return [...filtered.slice(-1), newToast];
      });

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

  // ── Real-Time Network Connectivity Resilience (Alerts field staff during signal drops) ──
  useEffect(() => {
    const handleOffline = () => {
      showToast("You are currently offline. Check your internet connection.", "warning", 0);
    };
    const handleOnline = () => {
      showToast("Connection restored. You are back online.", "success", 4000);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-5 left-1/2 -translate-x-1/2 z-[999999] flex flex-col items-center gap-2.5 pointer-events-none max-w-sm sm:max-w-md w-full px-4 sm:px-0"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const isError = toast.type === "error";
        const isWarning = toast.type === "warning";
        const isInfo = toast.type === "info";
        const isSuccess = !isError && !isWarning && !isInfo;

        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-3 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-800 rounded-xl px-4 py-3 shadow-xl shadow-black/10 dark:shadow-black/40 transition-all duration-150 animate-in slide-in-from-top-2 fade-in w-full"
          >
            <div className="shrink-0 flex items-center justify-center">
              {isError && <XCircle className="w-4 h-4 text-rose-500 shrink-0" strokeWidth={2.2} />}
              {isWarning && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" strokeWidth={2.2} />}
              {isInfo && <Info className="w-4 h-4 text-blue-500 shrink-0" strokeWidth={2.2} />}
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" strokeWidth={2.2} />}
            </div>

            <p className="text-sm font-medium leading-snug flex-1 break-words text-slate-800 dark:text-slate-200">
              {toast.message}
            </p>

            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 ml-1"
              aria-label="Close"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
