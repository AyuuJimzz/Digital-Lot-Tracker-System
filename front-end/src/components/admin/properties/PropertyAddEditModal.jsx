import React from "react";
import { X } from "lucide-react";

const inputCls =
  "w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-slate-700 rounded-lg shadow-sm bg-white dark:bg-slate-800/90 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:focus:border-blue-500 transition-all";

const PropertyAddEditModal = ({
  isOpen,
  editingProperty,
  formData,
  isSubmitting,
  submitStatus,
  onChange,
  onSubmit,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="bg-white dark:bg-slate-900 shadow-xl rounded-xl border border-gray-200 dark:border-slate-800 p-6 max-w-3xl mx-auto transition-all">
      <div className="flex items-center justify-between pb-4 mb-5 border-b border-gray-100 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {editingProperty ? "Edit Property Details" : "Add New Property"}
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Provide property details and address for automatic GPS pin locating
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="manage-property-name"
              className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1.5"
            >
              Property Name *
            </label>
            <input
              id="manage-property-name"
              type="text"
              name="property_name"
              value={formData.property_name || ""}
              onChange={onChange}
              placeholder="e.g. Lot-3847 Pagsanga-an"
              required
              className={inputCls}
            />
          </div>
          <div>
            <label
              htmlFor="manage-property-location"
              className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1.5"
            >
              Location / Address *
            </label>
            <input
              id="manage-property-location"
              type="text"
              name="location"
              value={formData.location || ""}
              onChange={onChange}
              placeholder="e.g. Pagsanga-an, Pavia, Iloilo"
              required
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg shadow-md transition-all cursor-pointer ${
              isSubmitting
                ? "bg-blue-500/80 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/25 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            }`}
          >
            {isSubmitting && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            <span>
              {isSubmitting
                ? submitStatus || "Processing..."
                : editingProperty
                  ? "Save Changes"
                  : "Create & Locate on Map"}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default PropertyAddEditModal;
