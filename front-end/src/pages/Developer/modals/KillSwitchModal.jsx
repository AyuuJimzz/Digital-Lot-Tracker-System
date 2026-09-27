import React from "react";

export default function KillSwitchModal({
  showKillSwitchModal,
  setShowKillSwitchModal,
  lastKillSwitchTime,
  killSwitchSuccessMsg,
  killSwitchLoading,
  handleTriggerKillSwitch,
}) {
  if (!showKillSwitchModal) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-150">
      <div className="bg-slate-900 border border-rose-500/40 max-w-md w-full rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center text-2xl shrink-0">
            🛑
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Confirm Global Force Logout</h3>
            <p className="text-xs text-rose-400 font-medium">Emergency Session & JWT Invalidation</p>
          </div>
        </div>

        <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-xl space-y-2 text-xs text-slate-300 leading-relaxed">
          <p className="font-semibold text-rose-300">
            ⚠️ This action will immediately terminate ALL active login sessions across every Admin and Employee account.
          </p>
          <p>
            Every user currently logged in will have their JWT authentication tokens revoked and will be kicked back to the login screen on their next interaction.
          </p>
        </div>

        {lastKillSwitchTime && (
          <div className="text-[11px] text-slate-400 font-mono bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            Last Revocation Trigger: {new Date(lastKillSwitchTime).toLocaleString()}
          </div>
        )}

        {killSwitchSuccessMsg && (
          <div className="p-3 bg-slate-800/70 border border-slate-700 text-slate-300 text-xs rounded-xl font-medium">
            🎉 {killSwitchSuccessMsg}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => setShowKillSwitchModal(false)}
            disabled={killSwitchLoading}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleTriggerKillSwitch}
            disabled={killSwitchLoading}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {killSwitchLoading ? "Revoking All Sessions..." : "🛑 Yes, Force Logout All"}
          </button>
        </div>
      </div>
    </div>
  );
}
