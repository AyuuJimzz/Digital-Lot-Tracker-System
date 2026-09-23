import React from "react";

const MessengerTab = ({
  messengerMasterEnabled,
  handleToggleMessengerMaster,
  fetchMessengerRecipients,
  fetchRecipientsLoading,
  handleToggleFilter,
  alertFilters,
  messengerRecipients,
  dismissedCount,
  handleRestoreRecipients,
  messengerTestLoading,
  handleToggleRecipient,
  handleDismissRecipient,
  messengerTestMsg,
}) => {
  return (
    <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-150">
      {/* Header Bar */}
      <div className="border-b border-slate-800/80 px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-900/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-sky-400 flex items-center justify-center text-lg shrink-0">
            💬
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Facebook Messenger Bot & Alerts</h2>
            <p className="text-[11px] text-slate-400">Manage broadcast recipients, notification categories, and bot commands.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Master Switch */}
          <button
            type="button"
            onClick={handleToggleMessengerMaster}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 border ${
              messengerMasterEnabled
                ? "bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700"
                : "bg-rose-950/30 text-rose-300 border-rose-500/30 hover:bg-rose-950/50"
            }`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${messengerMasterEnabled ? "bg-emerald-400" : "bg-rose-500"}`} />
            <span>{messengerMasterEnabled ? "Alerts: Enabled" : "Alerts: Paused"}</span>
          </button>

          <button
            type="button"
            onClick={fetchMessengerRecipients}
            disabled={fetchRecipientsLoading}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={fetchRecipientsLoading ? "animate-spin" : ""}>
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>{fetchRecipientsLoading ? "Scanning..." : "Scan Contacts"}</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-5">
        {/* Master Paused Banner */}
        {!messengerMasterEnabled && (
          <div className="p-3.5 rounded-xl bg-slate-900 border border-rose-500/30 flex items-center justify-between gap-3 text-xs text-rose-300">
            <div className="flex items-center gap-2.5">
              <span>⏸️</span>
              <span>Messenger notifications are currently paused. No alerts will be sent to Facebook.</span>
            </div>
            <button
              type="button"
              onClick={handleToggleMessengerMaster}
              className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 rounded-lg text-[11px] font-semibold transition"
            >
              Resume
            </button>
          </div>
        )}

        {/* 1. Category Notification Filters (Clean 4-column Grid) */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
          <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
            <span>🔔</span>
            <span>Notification Filters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* Crash Errors */}
            <div
              onClick={() => handleToggleFilter("criticalErrors")}
              className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between select-none ${
                alertFilters.criticalErrors
                  ? "bg-slate-900 border-slate-700 text-white"
                  : "bg-slate-950 border-slate-800/60 text-slate-500 opacity-50"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-sm">🚨</span>
                <div>
                  <div className="text-xs font-bold">500 & Crash Errors</div>
                  <div className="text-[10px] text-slate-400">Database & server exceptions</div>
                </div>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                alertFilters.criticalErrors ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-500"
              }`}>
                {alertFilters.criticalErrors ? "ON" : "OFF"}
              </span>
            </div>

            {/* Lot Reservations */}
            <div
              onClick={() => handleToggleFilter("reservations")}
              className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between select-none ${
                alertFilters.reservations
                  ? "bg-slate-900 border-slate-700 text-white"
                  : "bg-slate-950 border-slate-800/60 text-slate-500 opacity-50"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-sm">📝</span>
                <div>
                  <div className="text-xs font-bold">Lot Reservations</div>
                  <div className="text-[10px] text-slate-400">Client & staff booking events</div>
                </div>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                alertFilters.reservations ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-500"
              }`}>
                {alertFilters.reservations ? "ON" : "OFF"}
              </span>
            </div>

            {/* Security Logins */}
            <div
              onClick={() => handleToggleFilter("authSecurity")}
              className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between select-none ${
                alertFilters.authSecurity
                  ? "bg-slate-900 border-slate-700 text-white"
                  : "bg-slate-950 border-slate-800/60 text-slate-500 opacity-50"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-sm">🛡️</span>
                <div>
                  <div className="text-xs font-bold">Security Logins</div>
                  <div className="text-[10px] text-slate-400">Admin & staff portal sign-ins</div>
                </div>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                alertFilters.authSecurity ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-500"
              }`}>
                {alertFilters.authSecurity ? "ON" : "OFF"}
              </span>
            </div>

            {/* System Config */}
            <div
              onClick={() => handleToggleFilter("systemChanges")}
              className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between select-none ${
                alertFilters.systemChanges
                  ? "bg-slate-900 border-slate-700 text-white"
                  : "bg-slate-950 border-slate-800/60 text-slate-500 opacity-50"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-sm">⚙️</span>
                <div>
                  <div className="text-xs font-bold">System Toggles</div>
                  <div className="text-[10px] text-slate-400">Maintenance mode & PIN updates</div>
                </div>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                alertFilters.systemChanges ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-500"
              }`}>
                {alertFilters.systemChanges ? "ON" : "OFF"}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Broadcast Recipients List */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <span>👥</span>
              <span>Broadcast Recipients ({messengerRecipients.filter((r) => r.isCurrent).length} Active)</span>
            </div>
            {dismissedCount > 0 && (
              <button
                type="button"
                onClick={handleRestoreRecipients}
                disabled={messengerTestLoading}
                className="text-[11px] text-slate-400 hover:text-slate-200 transition flex items-center gap-1"
              >
                <span>🔄</span>
                <span>Restore ({dismissedCount}) Hidden</span>
              </button>
            )}
          </div>

          {messengerRecipients.length === 0 ? (
            <div className="p-4 bg-slate-900/50 rounded-lg text-center text-xs text-slate-400">
              {fetchRecipientsLoading ? "Scanning Facebook Page chats..." : "No contacts found. Send a message to your Page first!"}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {messengerRecipients.map((rec) => (
                <div
                  key={rec.id}
                  className={`p-3 rounded-lg border transition flex items-center justify-between gap-2 ${
                    rec.isCurrent
                      ? "bg-slate-900/90 border-slate-700 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      rec.isCurrent ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-slate-800 text-slate-400"
                    }`}>
                      {rec.name?.charAt(0) || "U"}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-bold truncate">{rec.name}</div>
                      <div className="text-[10px] font-mono text-slate-400 truncate">PSID: {rec.id}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleRecipient(rec)}
                      disabled={messengerTestLoading}
                      className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                        rec.isCurrent
                          ? "bg-emerald-500/20 text-emerald-400 hover:bg-rose-500/20 hover:text-rose-300"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                      }`}
                    >
                      {rec.isCurrent ? "Active" : "Add"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDismissRecipient(rec)}
                      disabled={messengerTestLoading}
                      className="p-1 text-slate-500 hover:text-rose-400 transition"
                      title="Hide contact"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Available Messenger Bot Commands Directory */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <span>💬</span>
              <span>Available Messenger Bot Commands</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Chat directly to Facebook Page</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {/* Command 1: #ID */}
            <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs font-bold text-slate-200">#ID</span>
                <span className="text-[9px] font-mono text-slate-500">or UID / PSID</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Returns your unique Facebook Page-Scoped User ID for alert registration.
              </p>
            </div>

            {/* Command 2: STATUS */}
            <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs font-bold text-slate-200">STATUS</span>
                <span className="text-[9px] font-mono text-slate-500">or PING</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Replies with live server uptime, Aiven database latency, and platform status.
              </p>
            </div>

            {/* Command 3: LOGS */}
            <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs font-bold text-slate-200">LOGS</span>
                <span className="text-[9px] font-mono text-slate-500">or ERRORS</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Dispatches the 3 most recent system events, logins, and error audit logs.
              </p>
            </div>

            {/* Command 4: MAINT ON */}
            <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs font-bold text-slate-200">MAINT ON</span>
                <span className="text-[9px] font-mono text-slate-500">or MAINTENANCE ON</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Remotely activates 503 Maintenance Mode across public web routes.
              </p>
            </div>

            {/* Command 5: MAINT OFF */}
            <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs font-bold text-slate-200">MAINT OFF</span>
                <span className="text-[9px] font-mono text-slate-500">or MAINTENANCE OFF</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Deactivates Maintenance Mode and restores full public website access.
              </p>
            </div>

            {/* Command 6: HELP */}
            <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs font-bold text-slate-200">HELP</span>
                <span className="text-[9px] font-mono text-slate-500">or MENU</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Sends the complete directory of interactive bot commands.
              </p>
            </div>
          </div>

          <div className="pt-2 text-[10px] font-mono text-slate-500 flex flex-wrap items-center gap-4">
            <span>Webhook: <span className="text-slate-400">/api/messenger/webhook</span></span>
            <span>Verify Token: <span className="text-slate-400">golden_dragon_bot_2026</span></span>
          </div>
        </div>

        {messengerTestMsg.text && (
          <div className={`p-3 rounded-xl border text-xs ${
            messengerTestMsg.isError
              ? "bg-rose-950/20 border-rose-500/30 text-rose-300"
              : "bg-slate-900 border-slate-700 text-slate-200"
          }`}>
            {messengerTestMsg.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessengerTab;
