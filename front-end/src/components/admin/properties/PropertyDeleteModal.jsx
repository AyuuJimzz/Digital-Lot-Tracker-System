import React from "react";
import { AlertTriangle, X, Trash2 } from "lucide-react";

const PropertyDeleteModal = ({
  property,
  isDeleting,
  deleteError,
  onConfirm,
  onClose,
}) => {
  if (!property) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-property-modal-title"
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3 mb-4 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="delete-property-modal-title"
                className="text-lg font-bold text-gray-900 dark:text-white"
              >
                Delete Property?
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Permanent deletion confirmation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 cursor-pointer"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Property Details */}
        <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-3.5 mb-4 border border-gray-100 dark:border-slate-700/60 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              Property:
            </span>
            <span className="font-bold text-gray-900 dark:text-white text-right truncate max-w-[240px]">
              {property.property_name}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              Total Lots:
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-slate-200">
              {property.total_lots ?? 0} lots
            </span>
          </div>
        </div>

        {/* Warning Message */}
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl p-3.5 mb-4 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
          <p className="font-semibold mb-1 flex items-center gap-1.5 text-rose-800 dark:text-rose-200">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            Warning
          </p>
          <p>
            Deleting this property is permanent and may also delete its related lots and dependent records because of the current database cascade relationships.
          </p>
          <p className="mt-1 font-semibold text-rose-800 dark:text-rose-200">
            This action cannot be undone.
          </p>
        </div>

        {/* Error Message inside Modal */}
        {deleteError && (
          <div className="bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 rounded-lg p-3 text-xs mb-4">
            <span className="font-bold">Error: </span>
            {deleteError}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-md transition-all cursor-pointer ${
              isDeleting
                ? "bg-rose-400 dark:bg-rose-600/70 cursor-not-allowed"
                : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/25 focus:ring-2 focus:ring-rose-500 focus:outline-none"
            }`}
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Delete Property</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PropertyDeleteModal;
