import React, { useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Database,
  FolderOpen,
  LogIn,
  LogOut,
  Mail,
  Monitor,
  Power,
  Search,
  ShieldAlert,
  Smartphone,
  UsersRound,
} from "lucide-react";
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

// Senior-Grade Parser: Strips redundant repetitive texts and extracts clean action types & details
function parseLogAction(eventStr, logType, category) {
  const str = typeof eventStr === "string" ? eventStr : typeof eventStr === "object" ? JSON.stringify(eventStr) : String(eventStr || "");
  const lower = str.toLowerCase();

  // 1. Emergency Kill Switch / Global Revocation
  if (str.includes("KILL SWITCH") || lower.includes("kill switch") || lower.includes("force-logged out all")) {
    return {
      actionLabel: "Kill Switch",
      badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/30",
      iconBg: "bg-rose-500/10 text-rose-400 border-rose-500/30",
      Icon: Power,
      detail: "Global Session Revocation",
      message: str.replace(/🚨\s*EMERGENCY\s*GLOBAL\s*KILL\s*SWITCH:\s*/i, "").trim() || str,
    };
  }

  // 2. Login / Sign In
  if (lower.includes("logged in") || lower.includes("authenticated") || lower.includes("signed in")) {
    const bracketMatch = str.match(/\[(.*?)\]/);
    const detail = bracketMatch ? bracketMatch[1] : null;
    return {
      actionLabel: "Signed In",
      badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      iconBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      Icon: LogIn,
      detail: detail || null,
      message: null, // Avoid echoing redundant "User Logged In: email (ROLE)"
    };
  }

  // 3. Logout / Sign Out
  if (lower.includes("logged out") || lower.includes("force logout") || lower.includes("signed out")) {
    return {
      actionLabel: "Signed Out",
      badgeClass: "bg-slate-800 text-slate-300 border-slate-700",
      iconBg: "bg-slate-800 text-slate-400 border-slate-700",
      Icon: LogOut,
      detail: null,
      message: null, // Avoid echoing redundant "User Logged Out: email (ROLE)"
    };
  }

  // 4. Failed Login / Developer PIN Attempt
  if (lower.includes("failed login") || lower.includes("failed developer pin") || lower.includes("invalid pin")) {
    return {
      actionLabel: "Failed Attempt",
      badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      iconBg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      Icon: AlertTriangle,
      detail: lower.includes("pin") ? "Developer PIN Attempt" : "Invalid Credentials",
      message: null,
    };
  }

  // 5. Developer PIN Change
  if (lower.includes("pin was successfully changed") || lower.includes("pin changed")) {
    return {
      actionLabel: "PIN Changed",
      badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      iconBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      Icon: Activity,
      detail: "Developer Security PIN Updated",
      message: null,
    };
  }

  // 6. Maintenance Mode Toggle
  if (lower.includes("maintenance mode")) {
    const isEnabled = lower.includes("enabled");
    return {
      actionLabel: "Maintenance",
      badgeClass: isEnabled ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      iconBg: isEnabled ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      Icon: Activity,
      detail: isEnabled ? "Gate Locked (503 Active)" : "Gate Open (Normal Traffic)",
      message: null,
    };
  }

  // 7. System Error or Crash
  if ((logType || "").toUpperCase() === "ERROR" || (logType || "").toUpperCase() === "CRASH" || lower.includes("system error") || lower.includes("exception")) {
    return {
      actionLabel: "System Error",
      badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/30",
      iconBg: "bg-rose-500/10 text-rose-400 border-rose-500/30",
      Icon: AlertTriangle,
      detail: null,
      message: str,
    };
  }

  // 8. Email Notifications
  if ((logType || "").toUpperCase() === "EMAIL" || category === "EMAIL" || lower.includes("email")) {
    const isFailed = lower.includes("failed") || lower.includes("error");
    return {
      actionLabel: isFailed ? "Email Failed" : "Email Sent",
      badgeClass: isFailed ? "bg-rose-500/10 text-rose-400 border-rose-500/30" : "bg-sky-500/10 text-sky-400 border-sky-500/30",
      iconBg: isFailed ? "bg-rose-500/10 text-rose-400 border-rose-500/30" : "bg-sky-500/10 text-sky-400 border-sky-500/30",
      Icon: Mail,
      detail: null,
      message: str,
    };
  }

  // 9. Database & Demo Seed Operations
  if (category === "DATABASE" || lower.includes("backup") || lower.includes("purged") || lower.includes("generated") || lower.includes("capstone") || lower.includes("demo")) {
    const isBackup = lower.includes("backup");
    const isPurge = lower.includes("purged") || lower.includes("deleted");
    return {
      actionLabel: isBackup ? "SQL Backup" : isPurge ? "Demo Purge" : "Demo Seed",
      badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
      iconBg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
      Icon: Database,
      detail: null,
      message: str,
    };
  }

  // 10. General Activity Fallback
  return {
    actionLabel: logType || category || "Activity",
    badgeClass: "bg-slate-800 text-slate-300 border-slate-700",
    iconBg: "bg-slate-800 text-slate-300 border-slate-700",
    Icon: Activity,
    detail: null,
    message: str,
  };
}

function getRoleBadge(role, user) {
  const rawRole = String(role || "").toLowerCase();
  const rawUser = String(user || "").toLowerCase();

  if (rawRole === "developer" || rawUser.includes("developer")) {
    return {
      label: "Developer",
      className: "bg-amber-500/10 text-amber-300 border-amber-500/30 font-semibold",
    };
  }
  if (rawRole === "admin") {
    return {
      label: "Admin",
      className: "bg-purple-500/10 text-purple-300 border-purple-500/30 font-semibold",
    };
  }
  if (rawRole === "employee") {
    return {
      label: "Employee",
      className: "bg-sky-500/10 text-sky-300 border-sky-500/30 font-semibold",
    };
  }
  if (role && role !== "unknown") {
    return {
      label: role.charAt(0).toUpperCase() + role.slice(1),
      className: "bg-slate-800 text-slate-300 border-slate-700 font-semibold",
    };
  }
  return null;
}

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
      const action = parseLogAction(eventStr, log.type, selectedLogCategory);
      return (
        eventStr.toLowerCase().includes(q) ||
        action.actionLabel.toLowerCase().includes(q) ||
        (action.detail && action.detail.toLowerCase().includes(q)) ||
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

  // Group visible logs chronologically by day for seamless sticky headers without clipping
  const groupedVisibleLogs = [];
  visibleLogs.forEach((log) => {
    const day = getDayKey(log.timestamp);
    let group = groupedVisibleLogs.find((g) => g.day === day);
    if (!group) {
      group = { day, timestamp: log.timestamp, logs: [] };
      groupedVisibleLogs.push(group);
    }
    group.logs.push(log);
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
              className="min-w-0 max-w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer"
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

        {/* Modal Body: Scrollable Log List with Non-Clipping Sticky Headers */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto bg-[#030712] [scrollbar-width:thin] [scrollbar-color:#334155_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-slate-800 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
        >
          {matchingLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-5 text-center text-slate-500">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-2xl mb-3 text-slate-400">
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
              {groupedVisibleLogs.map((group) => (
                <div key={group.day} className="relative">
                  {/* Clean, Non-Clipping Sticky Day Header */}
                  <div className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950/95 px-5 py-2.5 backdrop-blur-md shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                      <h4 className="text-xs font-semibold text-slate-200 tracking-wide">{formatDay(group.timestamp)}</h4>
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
                      {matchingDayCounts.get(group.day) || group.logs.length}{" "}
                      {(matchingDayCounts.get(group.day) || group.logs.length) === 1 ? "event" : "events"}
                    </span>
                  </div>

                  {/* Day Log Cards */}
                  <div className="p-4 sm:p-5 space-y-2.5">
                    {group.logs.map((log, idx) => {
                      const eventStr = typeof log.event === "string" ? log.event : typeof log.event === "object" ? JSON.stringify(log.event) : String(log.event || "");
                      const action = parseLogAction(eventStr, log.type, selectedLogCategory);
                      const roleBadge = getRoleBadge(log.role, log.user);
                      const ActionIcon = action.Icon;

                      return (
                        <div
                          key={`${log.timestamp}-${idx}`}
                          className="group rounded-xl border border-slate-800/90 hover:border-slate-700/80 bg-slate-900/50 hover:bg-slate-900/80 p-3.5 transition-all flex items-start gap-3.5 shadow-sm"
                        >
                          {/* Action Icon Badge */}
                          <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center border ${action.iconBg} transition-transform group-hover:scale-105`}>
                            <ActionIcon size={16} aria-hidden="true" />
                          </div>

                          {/* Card Main Body */}
                          <div className="flex-1 min-w-0">
                            {/* Header row: Action Badge + Role Badge + User Email + Timestamp */}
                            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border flex items-center gap-1 ${action.badgeClass}`}>
                                  {action.actionLabel}
                                </span>

                                {roleBadge && (
                                  <span className={`text-[10px] px-2 py-0.5 rounded-md border ${roleBadge.className}`}>
                                    {roleBadge.label}
                                  </span>
                                )}

                                {log.user ? (
                                  <span className="text-xs font-semibold text-white tracking-wide truncate max-w-[220px] sm:max-w-xs">
                                    {log.user}
                                  </span>
                                ) : (
                                  <span className="text-xs font-medium text-slate-400">
                                    System Event
                                  </span>
                                )}
                              </div>

                              <span className="text-[11px] font-mono text-slate-400 shrink-0 font-medium bg-slate-950/80 px-2 py-0.5 rounded-md border border-slate-800">
                                {new Date(log.timestamp).toLocaleString()}
                              </span>
                            </div>

                            {/* Secondary Detail (e.g. Single Device Session Active) */}
                            {action.detail && (
                              <div className="mt-1 flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-300 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-md font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  {action.detail}
                                </span>
                              </div>
                            )}

                            {/* Custom Descriptive Message (if any) */}
                            {action.message && (
                              <div className="text-xs text-slate-300 font-normal leading-relaxed mt-1.5 break-words bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                                {action.message}
                              </div>
                            )}

                            {/* Device & IP Metadata Chips */}
                            {(log.device || log.ip) && (
                              <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center gap-2 flex-wrap text-[11px]">
                                {log.device && (
                                  <span className="inline-flex items-center gap-1.5 bg-slate-950/60 border border-slate-800/80 px-2.5 py-1 rounded-md text-slate-400">
                                    {/iphone|android|ipad/i.test(log.device) ? (
                                      <Smartphone size={12} className="text-slate-500 shrink-0" aria-hidden="true" />
                                    ) : (
                                      <Monitor size={12} className="text-slate-500 shrink-0" aria-hidden="true" />
                                    )}
                                    <span>{log.device}</span>
                                  </span>
                                )}
                                {log.ip && (
                                  <span className="inline-flex items-center gap-1.5 bg-slate-950/60 border border-slate-800/80 px-2.5 py-1 rounded-md font-mono text-slate-400">
                                    <span className="text-slate-500 font-sans text-[10px] font-bold uppercase tracking-wider">IP</span>
                                    <span>{log.ip}</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {matchingLogs.length > visibleLimit && (
                <div className="p-4 sm:p-5 pt-0">
                  <button
                    type="button"
                    onClick={() => setView({ category: selectedLogCategory, day: selectedDay, limit: visibleLimit + PAGE_SIZE })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer"
                  >
                    Show more · {matchingLogs.length - visibleLimit} remaining
                  </button>
                </div>
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
