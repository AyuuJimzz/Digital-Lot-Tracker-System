import React from "react";

export default function PurgeDataModal({
  showPurgeModal,
  setShowPurgeModal,
  purgeLoading,
  purgeSuccessMsg,
  handlePurgeTestDataConfirm,
}) {
  if (!showPurgeModal) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-rose-500/50 max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 text-xl">
            🧹
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Purge Demo Test Data</h3>
            <p className="text-xs text-slate-400">Safely wipe generated test records without affecting real customers</p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          This action will delete ONLY the automatically generated demo buyer inquiries and test transactions. All your genuine customer records and real sales remain completely untouched.
        </p>

        <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-xl space-y-2 text-xs">
          <div className="text-rose-400 font-semibold flex items-center gap-2">
            <span>❌</span> What will be DELETED:
          </div>
          <ul className="text-slate-400 list-disc list-inside space-y-1 text-[11px]">
            <li>Only generated demo transactions (<strong className="text-slate-200 font-mono">is_demo = 1</strong>)</li>
            <li>Only generated demo customers (<strong className="text-slate-200 font-mono">is_demo = 1</strong>)</li>
            <li>Subdivision lots tied to demo inquiries will reset back to <strong className="text-emerald-400">Available</strong></li>
          </ul>

          <div className="text-emerald-400 font-semibold flex items-center gap-2 pt-2 border-t border-slate-800/80">
            <span>🛡️</span> What will be PROTECTED & KEPT:
          </div>
          <ul className="text-slate-400 list-disc list-inside space-y-1 text-[11px]">
            <li><strong>All REAL customer inquiries & purchases</strong> entered by staff or clients</li>
            <li>All subdivision properties, master lot coordinates & map geometries</li>
            <li>All administrator & employee staff accounts</li>
          </ul>
        </div>

        {purgeSuccessMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl font-medium">
            {purgeSuccessMsg}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => setShowPurgeModal(false)}
            disabled={purgeLoading}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePurgeTestDataConfirm}
            disabled={purgeLoading}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-lg shadow-rose-600/30 disabled:opacity-50 cursor-pointer"
          >
            {purgeLoading ? "Purging Demo Data..." : "Yes, Purge Demo Data"}
          </button>
        </div>
      </div>
    </div>
  );
}
