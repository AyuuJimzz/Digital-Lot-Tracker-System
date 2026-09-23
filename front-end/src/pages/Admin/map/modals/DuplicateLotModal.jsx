import React from "react";
import ReactDOM from "react-dom";
import { X } from "lucide-react";

export const DuplicateLotModal = ({
  duplicateModalData,
  setDuplicateModalData,
  handleConfirmDuplicateLot,
}) => {
  if (!duplicateModalData || typeof document === "undefined") return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-start justify-between pb-3 mb-4 border-b border-gray-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Duplicate Lot</h3>
          <button
            type="button"
            onClick={() => setDuplicateModalData(null)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
          Enter an identifier for the new adjacent lot (cloned with matching dimensions):
        </p>
        <input
          type="text"
          autoFocus
          value={duplicateModalData.lotName}
          onChange={(e) =>
            setDuplicateModalData((prev) => ({ ...prev, lotName: e.target.value }))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConfirmDuplicateLot();
            if (e.key === "Escape") setDuplicateModalData(null);
          }}
          placeholder="e.g. Lot 2"
          className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white mb-5 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setDuplicateModalData(null)}
            className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={duplicateModalData.isSubmitting}
            onClick={handleConfirmDuplicateLot}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/25 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {duplicateModalData.isSubmitting ? "Duplicating..." : "Duplicate Lot"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DuplicateLotModal;
