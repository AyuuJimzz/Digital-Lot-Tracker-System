import React from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

export const DeleteLotModal = ({
  lotPendingDelete,
  closeDeleteModal,
  confirmDeleteLot,
  isDeletingLot,
  deleteLotError,
  propertyName,
  selectedLot,
}) => {
  if (!lotPendingDelete) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-[10002] flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-lot-modal-title"
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3 mb-4 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="delete-lot-modal-title" className="text-lg font-bold text-gray-900 dark:text-white">
                Delete Lot?
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Permanent deletion confirmation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeDeleteModal}
            disabled={isDeletingLot}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 cursor-pointer"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Lot Details */}
        <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-3.5 mb-4 border border-gray-100 dark:border-slate-700/60 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              Lot:
            </span>
            <span className="font-bold text-gray-900 dark:text-white text-right truncate max-w-[240px]">
              {lotPendingDelete.lot_number || `Lot #${lotPendingDelete.lot_id}`}
            </span>
          </div>
          {(propertyName || lotPendingDelete.property_name || selectedLot?.property_name) && (
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                Property:
              </span>
              <span className="font-medium text-gray-600 dark:text-slate-300 text-right truncate max-w-[240px]">
                {propertyName || lotPendingDelete.property_name || selectedLot?.property_name}
              </span>
            </div>
          )}
        </div>

        {/* Warning Message */}
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl p-3.5 mb-4 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
          <p className="font-semibold mb-1 flex items-center gap-1.5 text-rose-800 dark:text-rose-200">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            Warning
          </p>
          <p>
            Deleting this lot is permanent and may affect records associated with this lot.
          </p>
          <p className="mt-1 font-semibold text-rose-800 dark:text-rose-200">
            This action cannot be undone.
          </p>
        </div>

        {/* Error Message inside Modal */}
        {deleteLotError && (
          <div className="bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 rounded-lg p-3 text-xs mb-4">
            <span className="font-bold">Error: </span>
            {deleteLotError}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={closeDeleteModal}
            disabled={isDeletingLot}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmDeleteLot}
            disabled={isDeletingLot}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-md transition-all cursor-pointer ${
              isDeletingLot
                ? "bg-rose-400 dark:bg-rose-600/70 cursor-not-allowed"
                : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/25 focus:ring-2 focus:ring-rose-500 focus:outline-none"
            }`}
          >
            {isDeletingLot ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Delete Lot</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteLotModal;
