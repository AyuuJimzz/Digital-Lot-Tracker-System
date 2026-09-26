import React from "react";
import { LogOut, UserCircle } from "lucide-react";

export function AccountMenu({ onSettings, onLogout }) {
  return (
    <div
      role="group"
      aria-label="Account actions"
      className="absolute right-0 z-[9999] mt-3 w-56 space-y-1 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900 dark:ring-white/5"
    >
      <button
        type="button"
        onClick={onSettings}
        className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <UserCircle className="h-4 w-4 shrink-0 text-gray-500 dark:text-slate-400" aria-hidden="true" />
        Profile & Settings
      </button>

      <button
        type="button"
        onClick={onLogout}
        className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-500 dark:text-rose-400 dark:hover:bg-rose-500/10"
      >
        <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
        Logout
      </button>
    </div>
  );
}
