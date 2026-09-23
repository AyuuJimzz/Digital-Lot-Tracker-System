import React from "react";

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
  if (!selectedLogCategory) return null;

  let categoryLogs = (logs || []).filter((log) => {
    const type = (log.type || "").toUpperCase();
    const event = log.event || "";
    if (selectedLogCategory === "AUTH") return type === "AUTH";
    if (selectedLogCategory === "SECURITY") return ["SECURITY", "ERROR", "CRASH"].includes(type) || event.includes("KILL SWITCH") || event.includes("System Error");
    if (selectedLogCategory === "DATABASE") return type === "DATABASE" || type === "BACKUP" || event.includes("demo") || event.includes("Capstone") || event.includes("Purge");
    if (selectedLogCategory === "SYSTEM") return ["MAINTENANCE", "SYSTEM", "ADMIN", "EMAIL"].includes(type);
    return true;
  });

  if (logModalSearch?.trim()) {
    const q = logModalSearch.toLowerCase();
    categoryLogs = categoryLogs.filter((log) => {
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

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[65] flex items-center justify-center p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-150">
      <div className="bg-slate-900 border border-slate-700/80 max-w-3xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center text-lg shrink-0">
              {selectedLogCategory === "AUTH" && "👥"}
              {selectedLogCategory === "SECURITY" && "🚨"}
              {selectedLogCategory === "DATABASE" && "💾"}
              {selectedLogCategory === "SYSTEM" && "🛠️"}
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
              onChange={(e) => setLogModalSearch(e.target.value)}
              placeholder="Search by email, action, device, or IP..."
              className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl pl-8 pr-3 py-2 outline-none focus:border-slate-600 transition placeholder-slate-500"
            />
            {logModalSearch && (
              <button
                type="button"
                onClick={() => setLogModalSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Right Action: Clear Category Logs */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {showClearCategoryConfirm ? (
              <div className="flex items-center gap-2 animate-in fade-in">
                <span className="text-xs text-rose-400 font-medium">Clear all in this category?</span>
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
                Clear Category Logs
              </button>
            )}
          </div>
        </div>

        {/* Modal Body: Scrollable Log List */}
        <div className="flex-1 p-5 overflow-y-auto space-y-3 bg-[#030712] [scrollbar-width:thin] [scrollbar-color:#334155_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-slate-800 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
          {categoryLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-2xl mb-3">
                {logModalSearch ? "🔍" : "📁"}
              </div>
              <p className="text-sm font-semibold text-slate-300">
                {logModalSearch ? `No logs found matching "${logModalSearch}"` : "No logs recorded in this category yet."}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {logModalSearch ? "Try adjusting your search keywords." : "Actions matching this category will appear here automatically."}
              </p>
            </div>
          ) : (
            categoryLogs.map((log, idx) => {
              const eventStr = typeof log.event === "string" ? log.event : typeof log.event === "object" ? JSON.stringify(log.event) : String(log.event || "");
              const isLogin = eventStr.toLowerCase().includes("logged in") || eventStr.toLowerCase().includes("authenticated");
              const isLogout = eventStr.toLowerCase().includes("logged out") || eventStr.toLowerCase().includes("force logout");
              const isKillSwitch = eventStr.includes("KILL SWITCH") || eventStr.includes("Force-logged out");
              const isError = (log.type || "").toUpperCase() === "ERROR" || (log.type || "").toUpperCase() === "CRASH" || eventStr.includes("System Error") || eventStr.includes("Exception");
              const isEmail = (log.type || "").toUpperCase() === "EMAIL";
              const rawRole = String(log.role || "").toLowerCase();
              const rawUser = String(log.user || "").toLowerCase();

              let roleBadgeColor = "bg-slate-800 text-slate-400 border-slate-700";
              let roleLabel = "User";
              let roleIcon = "👤";

              if (rawRole === "developer" || rawUser.includes("developer")) {
                roleBadgeColor = "bg-slate-800 text-slate-200 border-slate-700 font-semibold";
                roleLabel = "Developer";
                roleIcon = "🛡️";
              } else if (rawRole === "admin") {
                roleBadgeColor = "bg-slate-800 text-slate-200 border-slate-700 font-semibold";
                roleLabel = "Admin";
                roleIcon = "👑";
              } else if (rawRole === "employee") {
                roleBadgeColor = "bg-slate-800 text-slate-200 border-slate-700 font-semibold";
                roleLabel = "Employee";
                roleIcon = "👔";
              }

              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-800/90 hover:border-slate-700 bg-slate-900/60 transition flex items-start gap-3.5"
                >
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-sm border bg-slate-800 border-slate-700 text-slate-300 mt-0.5">
                    {isKillSwitch ? "🛑" : isError ? "❌" : isLogin ? "🟢" : isLogout ? "👋" : isEmail ? "📧" : selectedLogCategory === "DATABASE" ? "💾" : "⚙️"}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                      <div className="flex items-center gap-2">
                        {log.user ? (
                          <>
                            <span className={`text-[10px] px-2 py-0.5 rounded-md border flex items-center gap-1 ${roleBadgeColor}`}>
                              <span>{roleIcon}</span>
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
                      {log.device && <span>📱 {log.device}</span>}
                      {log.ip && <span>🌐 IP: {log.ip}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            Showing category: <strong className="text-white">{selectedLogCategory}</strong>
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
