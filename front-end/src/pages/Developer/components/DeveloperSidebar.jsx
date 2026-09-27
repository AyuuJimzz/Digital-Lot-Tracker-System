import React from "react";

const DeveloperSidebar = ({
  mobileSidebarOpen,
  setMobileSidebarOpen,
  activeSidebarTab,
  setActiveSidebarTab,
  maintenanceMode,
}) => {
  return (
    <>
      {/* ── LEFT FIXED SIDEBAR NAVIGATION ── */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-slate-950/95 backdrop-blur-2xl border-r border-slate-800/80 flex flex-col justify-between transition-transform duration-300 lg:translate-x-0 ${
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        {/* Sidebar Brand Header */}
        <div className="p-5 border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <div>
                <h1 className="text-sm font-bold text-white tracking-tight">Developer Console</h1>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  Secure console
                </span>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Sidebar Navigation Links */}
        <div className="p-3.5 space-y-1.5 flex-1 overflow-y-auto">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-2">
            Modules
          </div>

          {/* 1. System Controls & Logs */}
          <button
            type="button"
            onClick={() => {
              setActiveSidebarTab("SYSTEM");
              setMobileSidebarOpen(false);
            }}
            className={`w-full p-3 rounded-xl transition flex items-center justify-between text-left group ${
              activeSidebarTab === "SYSTEM"
                ? "bg-slate-800/70 border border-slate-700 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${activeSidebarTab === "SYSTEM" ? "bg-slate-800/70 text-slate-300" : "bg-slate-900 text-slate-400 group-hover:text-slate-300"}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-semibold">System & logs</div>
              </div>
            </div>
          </button>

          {/* 2. Database & Storage */}
          <button
            type="button"
            onClick={() => {
              setActiveSidebarTab("DATABASE");
              setMobileSidebarOpen(false);
            }}
            className={`w-full p-3 rounded-xl transition flex items-center justify-between text-left group ${
              activeSidebarTab === "DATABASE"
                ? "bg-slate-800/70 border border-slate-700 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${activeSidebarTab === "DATABASE" ? "bg-slate-800/70 text-slate-300" : "bg-slate-900 text-slate-400 group-hover:text-slate-300"}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-semibold">Database</div>
              </div>
            </div>
          </button>

          {/* 3. Map Diagnostics */}
          <button
            type="button"
            onClick={() => {
              setActiveSidebarTab("MAP");
              setMobileSidebarOpen(false);
            }}
            className={`w-full p-3 rounded-xl transition flex items-center justify-between text-left group ${
              activeSidebarTab === "MAP"
                ? "bg-slate-800/70 border border-slate-700 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${activeSidebarTab === "MAP" ? "bg-slate-800/70 text-slate-300" : "bg-slate-900 text-slate-400 group-hover:text-slate-300"}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  <line x1="8" y1="2" x2="8" y2="18" />
                  <line x1="16" y1="6" x2="16" y2="22" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-semibold">Map diagnostics</div>
              </div>
            </div>
          </button>

          {/* 4. Accounts & Credentials */}
          <button
            type="button"
            onClick={() => {
              setActiveSidebarTab("ACCOUNTS");
              setMobileSidebarOpen(false);
            }}
            className={`w-full p-3 rounded-xl transition flex items-center justify-between text-left group ${
              activeSidebarTab === "ACCOUNTS"
                ? "bg-slate-800/70 border border-slate-700 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${activeSidebarTab === "ACCOUNTS" ? "bg-slate-800/70 text-slate-300" : "bg-slate-900 text-slate-400 group-hover:text-slate-300"}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-semibold">Accounts</div>
              </div>
            </div>
          </button>

          {/* 5. API Routes & Endpoint Health */}
          <button
            type="button"
            onClick={() => {
              setActiveSidebarTab("ENDPOINTS");
              setMobileSidebarOpen(false);
            }}
            className={`w-full p-3 rounded-xl transition flex items-center justify-between text-left group ${
              activeSidebarTab === "ENDPOINTS"
                ? "bg-slate-800/70 border border-slate-700 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${activeSidebarTab === "ENDPOINTS" ? "bg-slate-800/70 text-slate-300" : "bg-slate-900 text-slate-400 group-hover:text-slate-300"}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-semibold">API health</div>
              </div>
            </div>
          </button>

          {/* 6. Environment (.env) Health Inspector */}
          <button
            type="button"
            onClick={() => {
              setActiveSidebarTab("ENV");
              setMobileSidebarOpen(false);
            }}
            className={`w-full p-3 rounded-xl transition flex items-center justify-between text-left group ${
              activeSidebarTab === "ENV"
                ? "bg-slate-800/70 border border-slate-700 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${activeSidebarTab === "ENV" ? "bg-slate-800/70 text-slate-300" : "bg-slate-900 text-slate-400 group-hover:text-slate-300"}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-semibold">Environment</div>
              </div>
            </div>
          </button>

        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800/80 space-y-2.5 bg-slate-950/80">
          <div className="flex items-center justify-between p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl">
            <span className="text-[11px] text-slate-400">Maintenance State</span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              maintenanceMode
                ? "bg-slate-800/70 text-slate-300 border-slate-700"
                : "bg-slate-800/70 text-slate-300 border-slate-700"
            }`}>
              {maintenanceMode ? "ACTIVE" : "DISABLED"}
            </span>
          </div>

          <button
            onClick={() => {
              sessionStorage.removeItem("devPin");
              window.location.href = "/login";
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Exit
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay Backdrop */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 lg:hidden"
        />
      )}
    </>
  );
};

export default DeveloperSidebar;
