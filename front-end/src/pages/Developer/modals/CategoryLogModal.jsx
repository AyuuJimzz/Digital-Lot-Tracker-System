import React, { useRef, useState } from "react";
import { Activity, AlertTriangle, Database, FolderOpen, LogIn, LogOut, Mail, Power, Search, ShieldAlert, UsersRound } from "lucide-react";
import { getCategoryLogs } from "../utils/logCategories";

const PAGE_SIZE = 25;
const categoryIcons = { AUTH: UsersRound, SECURITY: ShieldAlert, DATABASE: Database, SYSTEM: Activity };

const getDayKey = (timestamp) => {
  if (!timestamp) return "unknown";
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const formatDay = (timestamp) => {
  if (!timestamp) return "Unknown date";
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "Unknown date";
};

export default function CategoryLogModal({
  selectedLogCategory,
  setSelectedLogCategory,
  logs,
  logModalSearch,
  setLogModalSearch,
  showClearCategoryConfirm,
  setShowClearCategoryConfirm,
  clearCategoryLoading,
  handleClearCategoryLogs,
}) {
  const [view, setView] = useState({ category: null, day: null, limit: PAGE_SIZE });
  const listRef = useRef(null);

  if (!selectedLogCategory) return null;

  const categoryLogs = getCategoryLogs(logs, selectedLogCategory).sort(
    (a, b) => (new Date(b.timestamp).getTime() || 0) - (new Date(a.timestamp).getTime() || 0)
  );
  const dayCounts = new Map();
  categoryLogs.forEach((log) => {
    const day = getDayKey(log.timestamp);
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
  });
  const availableDays = [...dayCounts.keys()];
  const selectedDay = view.category === selectedLogCategory && (view.day === "all" || dayCounts.has(view.day))
    ? view.day
    : (availableDays[0] || "all");
  const visibleLimit = view.category === selectedLogCategory ? view.limit : PAGE_SIZE;

  let matchingLogs = categoryLogs;
  if (logModalSearch?.trim()) {
    const q = logModalSearch.trim().toLowerCase();
    matchingLogs = matchingLogs.filter((log) => {
      const eventStr = typeof log.event === "string" ? log.event : typeof log.event === "object" ? JSON.stringify(log.event) : String(log.event || "");
      const user = String(log.user || "").toLowerCase();
      const role = String(log.role || "").toLowerCase();
      const device = String(log.device || "").toLowerCase();
      const ip = String(log.ip || "").toLowerCase();
      return (
        eventStr.toLowerCase().includes(q) ||
        user.includes(q) ||
        role.includes(q) ||
        device.includes(q) ||
        ip.includes(q)
      );
    });
  }
  if (selectedDay !== "all") {
    matchingLogs = matchingLogs.filter((log) => getDayKey(log.timestamp) === selectedDay);
  }

  const visibleLogs = matchingLogs.slice(0, visibleLimit);
  const matchingDayCounts = new Map();
  matchingLogs.forEach((log) => {
    const day = getDayKey(log.timestamp);
    matchingDayCounts.set(day, (matchingDayCounts.get(day) || 0) + 1);
  });

  const updateDay = (day) => {
    setView({ category: selectedLogCategory, day, limit: PAGE_SIZE });
    listRef.current?.scrollTo({ top: 0 });
  };
  const CategoryIcon = categoryIcons[selectedLogCategory] || Activity;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[65] flex items-center justify-center p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-150">
      <div className="bg-slate-900 border border-slate-700/80 max-w-3xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
        {/* Modal Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center text-lg shrink-0">
              <CategoryIcon size={18} aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {selectedLogCategory === "AUTH" && "User & Staff Access Logs"}
                {selectedLogCategory === "SECURITY" && "Security & Revocation Audit Logs"}
                {selectedLogCategory === "DATABASE" && "Database & Seed Operations Logs"}
                {selectedLogCategory === "SYSTEM" && "System & Maintenance Gate Logs"}
              </h3>
              <p className="text-xs text-slate-400">
                {selectedLogCategory === "AUTH" && "Detailed audit trail of administrator, employee, and developer logins and session terminations."}
                {selectedLogCategory === "SECURITY" && "High-priority security alerts, Global Kill Switch triggers, and token revocations."}
                {selectedLogCategory === "DATABASE" && "Capstone demo data generations, customer & transaction purges, and SQL backup exports."}
                {selectedLogCategory === "SYSTEM" && "Maintenance mode 503 lock toggles, developer PIN updates, and server events."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedLogCategory(null)}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition shrink-0 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Filter & Action Toolbar */}
        <div className="px-5 py-3 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative w-full sm:w-80">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
            <input
              type="text"
              value={logModalSearch}
              onChange={(e) => {
                setLogModalSearch(e.target.value);
                updateDay(e.target.value.trim() ? "all" : (availableDays[0] || "all"));
              }}
              placeholder="Search by email, action, device, or IP..."
              className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl pl-8 pr-3 py-2 outline-none focus:border-slate-600 transition placeholder-slate-500"
            />
            {logModalSearch && (
              <button
                type="button"
                onClick={() => {
                  setLogModalSearch("");
                  updateDay(availableDays[0] || "all");
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Right Action: Clear Category Logs */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {showClearCategoryConfirm ? (
              <div className="flex flex-wrap items-center justify-end gap-2 animate-in fade-in">
                <span className="text-xs text-rose-400 font-medium">Clear this category across all days?</span>
                <button
                  type="button"
                  onClick={() => handleClearCategoryLogs(selectedLogCategory)}
                  disabled={clearCategoryLoading}
                  className="px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition disabled:opacity-50 cursor-pointer"
                >
                  {clearCategoryLoading ? "Clearing..." : "Yes, Clear"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearCategoryConfirm(false)}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowClearCategoryConfirm(true)}
                className="px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Clear category (all dates)
              </button>
            )}
          </div>
        </div>

        {/* Day navigation applies to the selected category, including search results. */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/80 px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <label htmlFor="log-day-filter" className="shrink-0 text-xs font-medium text-slate-400">Day</label>
            <select
              id="log-day-filter"
              value={selectedDay}
              onChange={(e) => updateDay(e.target.value)}
              className="min-w-0 max-w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <option value="all">All days ({categoryLogs.length})</option>
              {availableDays.map((day) => {
                const sample = categoryLogs.find((log) => getDayKey(log.timestamp) === day);
                return <option key={day} value={day}>{formatDay(sample?.timestamp)} ({dayCounts.get(day)})</option>;
              })}
            </select>
          </div>
          <span className="text-xs tabular-nums text-slate-400">
            {matchingLogs.length} {matchingLogs.length === 1 ? "record" : "records"} {selectedDay === "all" ? "across all days" : "on this day"}
          </span>
        </div>

        {/* Modal Body: Scrollable Log List */}
        <div ref={listRef} className="flex-1 p-5 overflow-y-auto space-y-3 bg-[#030712] [scrollbar-width:thin] [scrollbar-color:#334155_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-slate-800 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
          {matchingLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-2xl mb-3">
                {logModalSearch ? <Search size={22} aria-hidden="true" /> : <FolderOpen size={22} aria-hidden="true" />}
              </div>
              <p className="text-sm font-semibold text-slate-300">
                {logModalSearch ? `No logs found matching "${logModalSearch}"` : selectedDay === "all" ? "No logs recorded in this category yet." : "No activity recorded on this day."}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {logModalSearch ? "Try a different search or choose All days." : selectedDay === "all" ? "New activity will appear here." : "Choose another day to review its activity."}
              </p>
            </div>
          ) : (
            <>
            {visibleLogs.map((log, idx) => {
              const day = getDayKey(log.timestamp);
              const startsDay = idx === 0 || getDayKey(visibleLogs[idx - 1].timestamp) !== day;
              const eventStr = typeof log.event === "string" ? log.event : typeof log.event === "object" ? JSON.stringify(log.event) : String(log.event || "");
              const isLogin = eventStr.toLowerCase().includes("logged in") || eventStr.toLowerCase().includes("authenticated");
              const isLogout = eventStr.toLowerCase().includes("logged out") || eventStr.toLowerCase().includes("force logout");
              const isKillSwitch = eventStr.includes("KILL SWITCH") || eventStr.includes("Force-logged out");
              const isError = (log.type || "").toUpperCase() === "ERROR" || (log.type || "").toUpperCase() === "CRASH" || eventStr.includes("System Error") || eventStr.includes("Exception");
              const isEmail = (log.type || "").toUpperCase() === "EMAIL";
              const rawRole = String(log.role || "").toLowerCase();
              const rawUser = String(log.user || "").toLowerCase();
              const EventIcon = isKillSwitch ? Power : isError ? AlertTriangle : isLogin ? LogIn : isLogout ? LogOut : isEmail ? Mail : selectedLogCategory === "DATABASE" ? Database : Activity;

              let roleBadgeColor = "bg-slate-800 text-slate-400 border-slate-700";
              let roleLabel = "User";

              if (rawRole === "developer" || rawUser.includes("developer")) {
                roleBadgeColor = "bg-slate-800 text-slate-200 border-slate-700 font-semibold";
                roleLabel = "Developer";
              } else if (rawRole === "admin") {
                roleBadgeColor = "bg-slate-800 text-slate-200 border-slate-700 font-semibold";
                roleLabel = "Admin";
              } else if (rawRole === "employee") {
                roleBadgeColor = "bg-slate-800 text-slate-200 border-slate-700 font-semibold";
                roleLabel = "Employee";
              }

              return (
                <React.Fragment key={`${log.timestamp}-${idx}`}>
                {startsDay && (
                  <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-800 bg-[#030712]/95 py-2 backdrop-blur-sm">
                    <h4 className="text-xs font-semibold text-slate-200">{formatDay(log.timestamp)}</h4>
                    <span className="text-[11px] tabular-nums text-slate-500">{matchingDayCounts.get(day)} {matchingDayCounts.get(day) === 1 ? "event" : "events"}</span>
                  </div>
                )}
                <div
                  className="p-4 rounded-xl border border-slate-800/90 hover:border-slate-700 bg-slate-900/60 transition flex items-start gap-3.5"
                >
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-sm border bg-slate-800 border-slate-700 text-slate-300 mt-0.5">
                    <EventIcon size={16} aria-hidden="true" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                      <div className="flex items-center gap-2">
                        {log.user ? (
                          <>
                            <span className={`text-[10px] px-2 py-0.5 rounded-md border flex items-center gap-1 ${roleBadgeColor}`}>
                              <span>{roleLabel}</span>
                            </span>
                            <span className="text-xs font-bold text-white">
                              {log.user}
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                            {log.type || "SYSTEM"}
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] font-mono text-slate-400 shrink-0 font-medium bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-xs text-slate-200 font-medium leading-relaxed break-words">
                      {eventStr}
                    </div>

                    <div className="text-[10px] text-slate-400 font-mono mt-2 pt-2 border-t border-slate-800/60 flex items-center gap-3 flex-wrap">
                      {log.device && <span>Device: {log.device}</span>}
                      {log.ip && <span>IP: {log.ip}</span>}
                    </div>
                  </div>
                </div>
                </React.Fragment>
              );
            })}
            {matchingLogs.length > visibleLimit && (
              <button
                type="button"
                onClick={() => setView({ category: selectedLogCategory, day: selectedDay, limit: visibleLimit + PAGE_SIZE })}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Show more · {matchingLogs.length - visibleLimit} remaining
              </button>
            )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-400">
            Showing <strong className="text-white">{Math.min(visibleLimit, matchingLogs.length)}</strong> of <strong className="text-white">{matchingLogs.length}</strong> matching records
            <span className="ml-2 text-slate-500">· Up to 150 recent logs retained</span>
          </span>
          <button
            type="button"
            onClick={() => setSelectedLogCategory(null)}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            Close Modal
          </button>
        </div>
      </div>
    </div>
  );
}
