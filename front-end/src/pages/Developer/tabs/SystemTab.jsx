import React from "react";

const SystemTab = ({
  handleBackupDownload,
  dbLoading,
  maintenanceMode,
  handleToggleMaintenance,
  toggleLoading,
  isChangePinOpen,
  setIsChangePinOpen,
  setChangePinMsg,
  handleChangePinSubmit,
  showPinFields,
  setShowPinFields,
  currentPinInput,
  setCurrentPinInput,
  newPinInput,
  setNewPinInput,
  confirmNewPinInput,
  setConfirmNewPinInput,
  changePinMsg,
  changePinLoading,
  setShowKillSwitchModal,
  logs,
  setSelectedLogCategory,
  setLogModalSearch,
  setShowClearCategoryConfirm,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div id="zone-controls-logs" className="grid grid-cols-1 lg:grid-cols-12 gap-6 scroll-mt-6">
        {/* System Control Cards (Left Column - 5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card A: Database Backup */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center text-sm">
                    💾
                  </div>
                  <h2 className="text-sm font-bold text-white">Database Backup & Export</h2>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded">
                  .sql
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Extract complete table schemas and row data into an importable .sql dump file.
              </p>
            </div>

            <button
              onClick={handleBackupDownload}
              disabled={dbLoading}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {dbLoading ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-slate-300" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Extracting Database...</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  <span>Download Database (.sql)</span>
                </>
              )}
            </button>
          </div>

          {/* Card B: Maintenance Mode Gate */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center text-sm">
                    🔒
                  </div>
                  <h2 className="text-sm font-bold text-white">Maintenance Mode Gate</h2>
                </div>
                <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                  maintenanceMode
                    ? "bg-amber-950/40 text-amber-300 border-amber-500/30"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}>
                  {maintenanceMode ? "ACTIVE" : "DISABLED"}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                When enabled, public web routes intercept traffic with a 503 Maintenance screen.
              </p>
            </div>

            <div className="flex items-center justify-between bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl">
              <span className="text-xs font-medium text-slate-300">Toggle Maintenance State</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={maintenanceMode}
                  onChange={handleToggleMaintenance}
                  disabled={toggleLoading}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
              </label>
            </div>
          </div>

          {/* Card C: Developer Security PIN Tool */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 p-5 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center text-sm">
                  🔑
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Developer Security PIN</h2>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsChangePinOpen(!isChangePinOpen);
                  setChangePinMsg({ text: "", isError: false });
                }}
                className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
              >
                {isChangePinOpen ? "Cancel" : "Change PIN"}
              </button>
            </div>

            {!isChangePinOpen ? (
              <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between text-xs text-slate-400 mt-3">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-mono text-sm">••••</span>
                  <span>Active Developer Passkey</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                  PROTECTED
                </span>
              </div>
            ) : (
              <form onSubmit={handleChangePinSubmit} className="space-y-3 pt-2 animate-in fade-in duration-150">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Current PIN
                  </label>
                  <input
                    type={showPinFields ? "text" : "password"}
                    value={currentPinInput}
                    onChange={(e) => setCurrentPinInput(e.target.value)}
                    placeholder="Enter current PIN"
                    autoComplete="off"
                    className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl focus:border-slate-500 outline-none transition text-white placeholder-slate-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      New PIN
                    </label>
                    <input
                      type={showPinFields ? "text" : "password"}
                      value={newPinInput}
                      onChange={(e) => setNewPinInput(e.target.value)}
                      placeholder="Min 4 digits"
                      autoComplete="new-password"
                      className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl focus:border-slate-500 outline-none transition text-white placeholder-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Confirm PIN
                    </label>
                    <input
                      type={showPinFields ? "text" : "password"}
                      value={confirmNewPinInput}
                      onChange={(e) => setConfirmNewPinInput(e.target.value)}
                      placeholder="Re-type PIN"
                      autoComplete="new-password"
                      className="w-full text-xs px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl focus:border-slate-500 outline-none transition text-white placeholder-slate-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPinFields(!showPinFields)}
                    className="text-[10px] text-slate-400 hover:text-white transition"
                  >
                    {showPinFields ? "Hide digits" : "Show digits"}
                  </button>
                </div>

                {changePinMsg.text && (
                  <div className={`text-xs font-medium p-2.5 rounded-xl border ${changePinMsg.isError ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"}`}>
                    {changePinMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={changePinLoading || !currentPinInput.trim() || !newPinInput.trim() || !confirmNewPinInput.trim()}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {changePinLoading ? "Updating PIN..." : "Save PIN"}
                </button>
              </form>
            )}
          </div>

          {/* Card D: Emergency Global Kill Switch / Force Logout All */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-rose-400 flex items-center justify-center text-sm">
                    ⚠️
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Emergency Kill Switch</h2>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  SESSIONS
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Invalidates all active login sessions and JWT tokens for Admin and Employee accounts.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowKillSwitchModal(true)}
              className="w-full py-2.5 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 hover:text-rose-200 text-xs font-semibold rounded-xl border border-rose-500/30 transition flex items-center justify-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                <line x1="12" y1="2" x2="12" y2="12" />
              </svg>
              <span>Terminate All Active Sessions</span>
            </button>
          </div>
        </div>

        {/* ── SEPARATED ACTIVITY LOGS DIRECTORY (4 INTERACTIVE CARDS) ── */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Section Header */}
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📋</span> System Activity & Security Logs Directory
              </h3>
              <p className="text-xs text-slate-400">
                Select a category card below to inspect full logs, search entries, or clear audit records.
              </p>
            </div>
            <span className="text-[11px] font-mono font-semibold px-2.5 py-1 bg-slate-900 text-slate-300 border border-slate-800 rounded-xl">
              {logs.length} Total Logs
            </span>
          </div>

          {/* 4 Categorized Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Card 1: User & Staff Access Logs */}
            {(() => {
              const authLogs = logs.filter(l => (l.type || "").toUpperCase() === "AUTH");
              const loginsCount = authLogs.filter(l => {
                const ev = typeof l.event === "string" ? l.event : JSON.stringify(l.event || "");
                return ev.toLowerCase().includes("logged in") || ev.toLowerCase().includes("authenticated");
              }).length;
              const logoutsCount = authLogs.filter(l => {
                const ev = typeof l.event === "string" ? l.event : JSON.stringify(l.event || "");
                return ev.toLowerCase().includes("logged out") || ev.toLowerCase().includes("force logout");
              }).length;
              const latestAuth = authLogs[0];

              return (
                <div
                  onClick={() => {
                    setSelectedLogCategory("AUTH");
                    setLogModalSearch("");
                    setShowClearCategoryConfirm(false);
                  }}
                  className="cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl transition-all duration-200 group shadow-md flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-200 flex items-center justify-center text-lg group-hover:scale-105 transition">
                        👥
                      </div>
                      <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-slate-800/90 text-slate-300 border border-slate-700 flex items-center gap-1.5 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        {authLogs.length} {authLogs.length === 1 ? "Log" : "Logs"}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white group-hover:text-slate-100 transition">
                      User & Staff Access Logs
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Admin, Employee, and Developer authentications, logins & logouts.
                    </p>

                    {/* Clean Breakdown */}
                    <div className="mt-3.5 flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-400 border border-slate-800">
                        {loginsCount} Logins
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-400 border border-slate-800">
                        {logoutsCount} Logouts
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 group-hover:text-slate-200 font-medium">
                    <span className="text-[11px] text-slate-500 font-normal">
                      {latestAuth ? `Latest: ${new Date(latestAuth.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "No logs yet"}
                    </span>
                    <span className="flex items-center gap-1">Open Logs <span className="group-hover:translate-x-1 transition">→</span></span>
                  </div>
                </div>
              );
            })()}

            {/* Card 2: Security & Error Alerts */}
            {(() => {
              const secLogs = logs.filter(l => {
                const ev = typeof l.event === "string" ? l.event : JSON.stringify(l.event || "");
                const type = (l.type || "").toUpperCase();
                return type === "SECURITY" || type === "ERROR" || type === "CRASH" || ev.includes("KILL SWITCH") || ev.includes("System Error");
              });
              const errorsCount = secLogs.filter(l => {
                const type = (l.type || "").toUpperCase();
                const ev = typeof l.event === "string" ? l.event : JSON.stringify(l.event || "");
                return type === "ERROR" || type === "CRASH" || ev.includes("System Error") || ev.includes("Exception");
              }).length;
              const secOpsCount = secLogs.length - errorsCount;
              const latestSec = secLogs[0];

              return (
                <div
                  onClick={() => {
                    setSelectedLogCategory("SECURITY");
                    setLogModalSearch("");
                    setShowClearCategoryConfirm(false);
                  }}
                  className="cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl transition-all duration-200 group shadow-md flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-200 flex items-center justify-center text-lg group-hover:scale-105 transition">
                        🚨
                      </div>
                      <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-slate-800/90 text-slate-300 border border-slate-700 flex items-center gap-1.5 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        {secLogs.length} {secLogs.length === 1 ? "Alert" : "Alerts"}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white group-hover:text-slate-100 transition">
                      Security & System Error Alerts
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      API runtime errors, unhandled exceptions, kill switches & token revocations.
                    </p>

                    {/* Clean Breakdown */}
                    <div className="mt-3.5 flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-400 border border-slate-800">
                        {errorsCount} Errors
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-400 border border-slate-800">
                        {secOpsCount} Security Actions
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 group-hover:text-slate-200 font-medium">
                    <span className="text-[11px] text-slate-500 font-normal">
                      {latestSec ? `Latest: ${new Date(latestSec.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "No alerts"}
                    </span>
                    <span className="flex items-center gap-1">Open Logs <span className="group-hover:translate-x-1 transition">→</span></span>
                  </div>
                </div>
              );
            })()}

            {/* Card 3: Database & Capstone Demo Records */}
            {(() => {
              const dbLogs = logs.filter(l => {
                const ev = typeof l.event === "string" ? l.event : JSON.stringify(l.event || "");
                return (l.type || "").toUpperCase() === "DATABASE" || (l.type || "").toUpperCase() === "BACKUP" || ev.includes("demo") || ev.includes("Capstone") || ev.includes("Purge");
              });
              const seedCount = dbLogs.filter(l => {
                const ev = typeof l.event === "string" ? l.event : JSON.stringify(l.event || "");
                return ev.includes("demo") || ev.includes("Capstone");
              }).length;
              const purgeCount = dbLogs.filter(l => {
                const ev = typeof l.event === "string" ? l.event : JSON.stringify(l.event || "");
                return ev.includes("Purged") || ev.includes("purge");
              }).length;
              const latestDb = dbLogs[0];

              return (
                <div
                  onClick={() => {
                    setSelectedLogCategory("DATABASE");
                    setLogModalSearch("");
                    setShowClearCategoryConfirm(false);
                  }}
                  className="cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl transition-all duration-200 group shadow-md flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-200 flex items-center justify-center text-lg group-hover:scale-105 transition">
                        💾
                      </div>
                      <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-slate-800/90 text-slate-300 border border-slate-700 flex items-center gap-1.5 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        {dbLogs.length} {dbLogs.length === 1 ? "Record" : "Records"}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white group-hover:text-slate-100 transition">
                      Database & Demo Records
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Capstone demo seed data generation, test data purges, and .sql backups.
                    </p>

                    {/* Clean Breakdown */}
                    <div className="mt-3.5 flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-400 border border-slate-800">
                        {seedCount} Seeds
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-400 border border-slate-800">
                        {purgeCount} Purges
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 group-hover:text-slate-200 font-medium">
                    <span className="text-[11px] text-slate-500 font-normal">
                      {latestDb ? `Latest: ${new Date(latestDb.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "No records yet"}
                    </span>
                    <span className="flex items-center gap-1">Open Logs <span className="group-hover:translate-x-1 transition">→</span></span>
                  </div>
                </div>
              );
            })()}

            {/* Card 4: System, Emails & Maintenance Gates */}
            {(() => {
              const sysLogs = logs.filter(l => ["MAINTENANCE", "SYSTEM", "ADMIN", "EMAIL"].includes((l.type || "").toUpperCase()));
              const emailCount = sysLogs.filter(l => (l.type || "").toUpperCase() === "EMAIL").length;
              const sysOpsCount = sysLogs.length - emailCount;
              const latestSys = sysLogs[0];

              return (
                <div
                  onClick={() => {
                    setSelectedLogCategory("SYSTEM");
                    setLogModalSearch("");
                    setShowClearCategoryConfirm(false);
                  }}
                  className="cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl transition-all duration-200 group shadow-md flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-200 flex items-center justify-center text-lg group-hover:scale-105 transition">
                        🛠️
                      </div>
                      <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-slate-800/90 text-slate-300 border border-slate-700 flex items-center gap-1.5 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        {sysLogs.length} {sysLogs.length === 1 ? "Event" : "Events"}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white group-hover:text-slate-100 transition">
                      System, Emails & Maintenance
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Outgoing client emails, 503 maintenance mode, PIN updates & server events.
                    </p>

                    {/* Clean Breakdown */}
                    <div className="mt-3.5 flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-400 border border-slate-800">
                        {emailCount} Emails
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-400 border border-slate-800">
                        {sysOpsCount} Operations
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 group-hover:text-slate-200 font-medium">
                    <span className="text-[11px] text-slate-500 font-normal">
                      {latestSys ? `Latest: ${new Date(latestSys.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "No events yet"}
                    </span>
                    <span className="flex items-center gap-1">Open Logs <span className="group-hover:translate-x-1 transition">→</span></span>
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemTab;
