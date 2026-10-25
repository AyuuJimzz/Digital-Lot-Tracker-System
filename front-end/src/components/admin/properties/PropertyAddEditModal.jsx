import React, { useState, useEffect } from "react";
import { Building2, MapPin, X, Check, ClipboardPaste } from "lucide-react";

const inputCls =
  "mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500";
const labelCls = "block text-sm font-medium text-slate-700 dark:text-slate-200";

const parseCoordinatesString = (input) => {
  if (!input || typeof input !== "string") return null;
  const str = input.trim().replace(/^[([]|[)\]]$/g, "").trim();

  // 1. Google Maps URL (@lat,lng or ?q=lat,lng)
  const urlMatch = str.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || str.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (urlMatch) {
    return { lat: urlMatch[1], lng: urlMatch[2] };
  }

  // 2. Comma or whitespace separated "lat, lng" or "lat lng"
  const coordsMatch = str.match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
  if (coordsMatch) {
    return { lat: coordsMatch[1], lng: coordsMatch[2] };
  }

  return null;
};

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
  const [smartCoordsInput, setSmartCoordsInput] = useState("");
  const [autoSplitNotice, setAutoSplitNotice] = useState(false);

  useEffect(() => {
    if (formData?.latitude && formData?.longitude) {
      setSmartCoordsInput(`${formData.latitude}, ${formData.longitude}`);
    } else if (!formData?.latitude && !formData?.longitude) {
      setSmartCoordsInput("");
    }
  }, [formData?.latitude, formData?.longitude]);

  if (!isOpen) return null;

  const isEditing = Boolean(editingProperty);

  const applyCoordinates = (lat, lng) => {
    if (onChange) {
      onChange({ latitude: lat, longitude: lng });
    }
    setAutoSplitNotice(true);
    setTimeout(() => setAutoSplitNotice(false), 3500);
  };

  const handleSmartCoordsChange = (e) => {
    const val = e.target.value;
    setSmartCoordsInput(val);
    if (!val.trim()) {
      if (onChange) {
        onChange({ latitude: "", longitude: "" });
      }
      return;
    }
    const parsed = parseCoordinatesString(val);
    if (parsed) {
      applyCoordinates(parsed.lat, parsed.lng);
    }
  };

  const handlePasteCoordinates = (e) => {
    const pastedText = e.clipboardData?.getData("text") || "";
    const parsed = parseCoordinatesString(pastedText);
    if (parsed) {
      e.preventDefault();
      setSmartCoordsInput(`${parsed.lat}, ${parsed.lng}`);
      applyCoordinates(parsed.lat, parsed.lng);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (smartCoordsInput.trim()) {
      const parsed = parseCoordinatesString(smartCoordsInput);
      if (parsed && onChange) {
        onChange({ latitude: parsed.lat, longitude: parsed.lng });
      }
    }
    onSubmit(e);
  };

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

      <form onSubmit={handleFormSubmit} aria-busy={isSubmitting}>
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

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <label htmlFor="manage-property-coordinates" className={labelCls}>
                Coordinates <span className="text-xs font-normal text-slate-400">(Google Maps, optional)</span>
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <ClipboardPaste className="h-4 w-4" />
                </div>
                <input
                  id="manage-property-coordinates"
                  type="text"
                  value={smartCoordsInput}
                  onChange={handleSmartCoordsChange}
                  onPaste={handlePasteCoordinates}
                  placeholder="Paste from Google Maps (e.g. 10.768205, 122.474073)"
                  className={`${inputCls} pl-9 pr-28`}
                />
                {autoSplitNotice && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    <Check className="h-3.5 w-3.5" /> Auto-detected!
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Paste coordinates directly from Google Maps (e.g. 10.768205, 122.474073).
              </p>
            </div>
          </div>

          <aside className="h-fit rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">Custom Map Placement</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Enter GPS coordinates to place the property. If left blank, you can also <strong>drag its pin directly on Map View</strong> or slide to any spot and click <strong>"Set Center Here"</strong> to anchor it permanently.
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
