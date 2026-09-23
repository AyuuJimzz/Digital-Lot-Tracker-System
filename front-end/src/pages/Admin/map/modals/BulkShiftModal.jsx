import React from "react";
import ReactDOM from "react-dom";
import { AlertTriangle, X, CheckCircle2 } from "lucide-react";

export const BulkShiftModal = ({
  pendingBulkShift,
  handleCloseBulkShiftConfirm,
  isBulkShiftSubmitting,
  properties = [],
  selectedProperty,
  mapData,
  bulkShiftOffset = { lat: 0, lng: 0 },
  bulkShiftError,
  confirmBulkShift,
  bulkShiftSuccessMessage,
}) => {
  return (
    <>
      {/* ── In-App Bulk Shift Confirmation Modal ── */}
      {pendingBulkShift && typeof document !== "undefined" && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-shift-modal-title"
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 mb-4 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="bulk-shift-modal-title" className="text-lg font-bold text-gray-900 dark:text-white">
                    Confirm Bulk Lot Shift?
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Bulk coordinate movement confirmation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseBulkShiftConfirm}
                disabled={isBulkShiftSubmitting}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 cursor-pointer"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Shift Operation Details */}
            <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-3.5 mb-4 border border-gray-100 dark:border-slate-700/60 space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Property:
                </span>
                <span className="font-bold text-gray-900 dark:text-white text-right truncate max-w-[240px]">
                  {properties.find((p) => Number(p.id) === Number(selectedProperty))?.name || "Selected Property"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Affected Lots:
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  {mapData?.lots ? mapData.lots.filter((l) => Number(l.property_id) === Number(selectedProperty)).length : 0} lots
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Coordinate Offset:
                </span>
                <span className="font-mono text-xs text-gray-600 dark:text-slate-300">
                  ΔLat: {bulkShiftOffset.lat.toFixed(6)}, ΔLng: {bulkShiftOffset.lng.toFixed(6)}
                </span>
              </div>
            </div>

            {/* Warning Message */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3.5 mb-4 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              <p className="font-semibold mb-1 flex items-center gap-1.5 text-amber-900 dark:text-amber-100">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                Warning
              </p>
              <p>
                This operation will update multiple lot coordinates/positions at once.
              </p>
              <p className="mt-1 font-semibold text-amber-900 dark:text-amber-100">
                This action should only continue if the admin confirms the changes.
              </p>
            </div>

            {/* Error Message inside Modal */}
            {bulkShiftError && (
              <div className="bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 rounded-lg p-3 text-xs mb-4">
                <span className="font-bold">Error: </span>
                {bulkShiftError}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCloseBulkShiftConfirm}
                disabled={isBulkShiftSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBulkShift}
                disabled={isBulkShiftSubmitting}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-md transition-all cursor-pointer ${
                  isBulkShiftSubmitting
                    ? "bg-emerald-400 dark:bg-emerald-600/70 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                }`}
              >
                {isBulkShiftSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Applying...</span>
                  </>
                ) : (
                  <span>Confirm Shift</span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Floating Success Banner */}
      {bulkShiftSuccessMessage && typeof document !== "undefined" && ReactDOM.createPortal(
        <div className="fixed top-6 right-6 z-[99999] flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl animate-in fade-in duration-150 text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
          <span>{bulkShiftSuccessMessage}</span>
        </div>,
        document.body
      )}
    </>
  );
};

export default BulkShiftModal;
