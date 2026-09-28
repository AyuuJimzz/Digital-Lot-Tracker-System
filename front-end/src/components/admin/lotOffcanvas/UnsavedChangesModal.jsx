import React from "react";
import { AlertTriangle, X } from "lucide-react";

export const UnsavedChangesModal = ({
  isOpen,
  onKeepEditing,
  onDiscard,
  lotNumber,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-[10005] flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-modal-title"
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3 mb-4 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="unsaved-modal-title" className="text-lg font-bold text-gray-900 dark:text-white">
                Discard Unsaved Changes?
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                You have unsaved edits in this lot drawer
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onKeepEditing}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Keep editing"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="bg-amber-50/60 dark:bg-amber-950/20 rounded-xl p-3.5 mb-5 border border-amber-200/60 dark:border-amber-900/40 text-sm">
          <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
            {lotNumber ? (
              <>
                You made modifications to <span className="font-semibold">{lotNumber}</span> that haven't been saved yet.
              </>
            ) : (
              "You made modifications to this lot that haven't been saved yet."
            )}{" "}
            Closing now will permanently discard your recent edits.
          </p>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onKeepEditing}
            className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-semibold text-xs hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Keep Editing
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
          >
            Discard Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnsavedChangesModal;
