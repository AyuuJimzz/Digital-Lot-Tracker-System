import React from "react";

const DeveloperHeader = ({
  setMobileSidebarOpen,
  activeSidebarTab,
  dbStats,
  fetchDbStats,
  fetchMapDiagnostics,
  fetchAdmins,
  fetchEmployees,
}) => {
  return (
    <header className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger */}
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="lg:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span>Developer Console</span>
            <span className="text-slate-600">/</span>
            <span className="text-white font-bold">
              {activeSidebarTab === "SYSTEM" && "System & logs"}
              {activeSidebarTab === "DATABASE" && "Database"}
              {activeSidebarTab === "MAP" && "Map diagnostics"}
              {activeSidebarTab === "ACCOUNTS" && "Accounts"}
              {activeSidebarTab === "ENDPOINTS" && "API health"}
              {activeSidebarTab === "ENV" && "Environment"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Quick Ping / Refresh */}
        {dbStats && (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-slate-800/70 text-slate-300 border border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
            DB {dbStats.latencyMs}ms
          </span>
        )}

        <button
          onClick={() => {
            fetchDbStats();
            fetchMapDiagnostics();
            fetchAdmins();
            fetchEmployees();
          }}
          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
          title="Refresh console metrics"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          Refresh
        </button>
      </div>
    </header>
  );
};

export default DeveloperHeader;
