import React from "react";
import { Building2, MapPin, X } from "lucide-react";

const inputCls =
  "mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500";
const labelCls = "block text-sm font-medium text-slate-700 dark:text-slate-200";

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

  const isEditing = Boolean(editingProperty);

  return (
    <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="property-form-title">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6 dark:border-slate-700">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="property-form-title" className="text-base font-semibold text-slate-900 dark:text-white">
              {isEditing ? "Edit property" : "Add property"}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {isEditing ? "Update the property name and location." : "Add a subdivision or cadastre to the estate list."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close property form"
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={onSubmit} aria-busy={isSubmitting}>
        <div className="grid gap-6 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Property details</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Fields marked * are required.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="manage-property-name" className={labelCls}>Property name *</label>
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
                <label htmlFor="manage-property-location" className={labelCls}>Location / address *</label>
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
          </div>

          <aside className="h-fit rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">Map placement</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Enter a specific address to help locate the property. Verify its position in Map View after saving.
            </p>
          </aside>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6 dark:border-slate-700 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />}
            {isSubmitting ? submitStatus || "Saving..." : isEditing ? "Save changes" : "Create & locate on map"}
          </button>
        </div>
      </form>
    </section>
  );
};

export default PropertyAddEditModal;
