import React from "react";
import { DatabaseBackup, KeyRound, LockKeyhole, Power } from "lucide-react";
import LogDirectory from "../components/LogDirectory";

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
      <div id="zone-controls-logs" className="grid grid-cols-1 items-start gap-6 scroll-mt-6 lg:grid-cols-12">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 shadow-xl shadow-black/10 lg:col-span-5" aria-labelledby="system-controls-title">
          <div className="border-b border-slate-800 bg-slate-900/70 px-5 py-5">
            <h2 id="system-controls-title" className="text-base font-semibold tracking-tight text-white">System controls</h2>
            <p className="mt-1 text-xs text-slate-400">Backup, access, and maintenance settings.</p>
          </div>
          {/* Card A: Database Backup */}
          <div className="border-b border-slate-800 px-5 py-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center text-sm">
                    <DatabaseBackup size={16} aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">Database backup</h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded">
                  .sql
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Export tables and records as a SQL backup.
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
          <div className="border-b border-slate-800 px-5 py-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center text-sm">
                    <LockKeyhole size={16} aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">Maintenance mode</h3>
                </div>
                <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                  maintenanceMode
                    ? "bg-slate-800/70 text-slate-300 border-slate-700"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}>
                  {maintenanceMode ? "ACTIVE" : "DISABLED"}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Temporarily show the maintenance screen to visitors.
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
                  aria-label="Maintenance mode"
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-700 peer-focus-visible:ring-2 peer-focus-visible:ring-slate-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-500" />
              </label>
            </div>
          </div>

          {/* Card C: Developer Security PIN Tool */}
          <div className="border-b border-slate-800 px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center text-sm">
                  <KeyRound size={16} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Developer PIN</h3>
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
                  <div className={`text-xs font-medium p-2.5 rounded-xl border ${changePinMsg.isError ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-slate-300 bg-slate-800/70 border-slate-700"}`}>
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
          <div className="bg-slate-950/25 px-5 py-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-rose-400 flex items-center justify-center text-sm">
                    <Power size={16} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">End all sessions</h3>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  SESSIONS
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Sign out all admins and employees. Use only for a security incident.
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
        </section>

        <div className="lg:col-span-7 min-w-0">
          <LogDirectory
            logs={logs}
            setSelectedLogCategory={setSelectedLogCategory}
            setLogModalSearch={setLogModalSearch}
            setShowClearCategoryConfirm={setShowClearCategoryConfirm}
          />
        </div>
      </div>
    </div>
  );
};

export default SystemTab;
