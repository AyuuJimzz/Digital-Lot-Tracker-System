import React from "react";
import { Activity, ArrowUpRight, Database, ScrollText, ShieldAlert, UsersRound } from "lucide-react";
import { getCategoryLogs } from "../utils/logCategories";

const categories = [
  {
    id: "AUTH",
    title: "Access & sign-ins",
    description: "Account sign-ins, sign-outs, and access events",
    icon: UsersRound,
  },
  {
    id: "SECURITY",
    title: "Security & errors",
    description: "Security actions, API errors, and exceptions",
    icon: ShieldAlert,
  },
  {
    id: "DATABASE",
    title: "Database operations",
    description: "Backups, demo data, and purge activity",
    icon: Database,
  },
  {
    id: "SYSTEM",
    title: "System & email",
    description: "Maintenance, email, and console events",
    icon: Activity,
  },
];

const getLatestActivity = (logs) => {
  const latest = logs.reduce((max, log) => {
    const timestamp = new Date(log.timestamp).getTime();
    return Number.isFinite(timestamp) ? Math.max(max, timestamp) : max;
  }, 0);

  return latest
    ? new Date(latest).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    : "No activity yet";
};

export default function LogDirectory({
  logs,
  setSelectedLogCategory,
  setLogModalSearch,
  setShowClearCategoryConfirm,
}) {
  const entries = logs || [];

  const openCategory = (category) => {
    setSelectedLogCategory(category);
    setLogModalSearch("");
    setShowClearCategoryConfirm(false);
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 shadow-xl shadow-black/10" aria-labelledby="log-directory-title">
      <div className="border-b border-slate-800 bg-slate-900/70 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/70 text-slate-300">
              <ScrollText size={19} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="log-directory-title" className="text-base font-semibold tracking-tight text-white">Activity & security logs</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">Browse events by category, then search or review individual records.</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-700/80 bg-slate-950/70 px-3 py-2 text-right">
            <span className="block text-lg font-semibold leading-none text-white tabular-nums">{entries.length}</span>
            <span className="mt-1 block text-[10px] font-medium uppercase tracking-wider text-slate-400">Total logs</span>
          </div>
        </div>
      </div>

      <div className="px-3 py-3 sm:px-4">
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Browse categories</p>
        <div className="space-y-2">
          {categories.map(({ id, title, description, icon: Icon }) => {
            const categoryLogs = getCategoryLogs(entries, id);

            return (
              <button
                key={id}
                type="button"
                onClick={() => openCategory(id)}
                aria-label={`Open ${title} logs, ${categoryLogs.length} records`}
                className="group flex min-h-20 w-full min-w-0 items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-3 text-left transition-colors duration-200 hover:border-slate-600 hover:bg-slate-800/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 sm:gap-4 sm:px-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/70 text-slate-300">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-100 transition-colors group-hover:text-white">{title}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-slate-400">{description}</span>
                  <span className="mt-1.5 block text-[11px] text-slate-500">{getLatestActivity(categoryLogs)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="min-w-8 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-center text-xs font-semibold tabular-nums text-slate-200">{categoryLogs.length}</span>
                  <ArrowUpRight size={16} className="text-slate-500 transition-colors group-hover:text-slate-200" aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
