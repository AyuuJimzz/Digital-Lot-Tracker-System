import React from "react";

export const LotMetadataSection = ({
  lotNumber,
  setLotNumber,
  areaSqm,
  setAreaSqm,
  isAdmin,
  isNonSaleable,
  validationErrors,
  setValidationErrors,
  onLiveLotUpdate,
  selectedLot,
  status,
  isSaving = false,
}) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Lot Number */}
      <div>
        <label
          htmlFor="lot-offcanvas-lot-number"
          className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 truncate"
          title="Lot Number / Label"
        >
          Lot Number / Label
        </label>
        <input
          id="lot-offcanvas-lot-number"
          name="lot_number"
          type="text"
          value={lotNumber}
          onChange={(e) => {
            setLotNumber(e.target.value);
            if (validationErrors.lotNumber) {
              setValidationErrors((prev) => ({ ...prev, lotNumber: false }));
            }
          }}
          disabled={!isAdmin || isSaving}
          readOnly={!isAdmin || isSaving}
          title={!isAdmin ? "Only Admins can edit lot number" : isSaving ? "Saving..." : ""}
          className={`min-h-11 w-full rounded-lg border px-3 py-2 text-sm font-semibold text-gray-900 transition-colors focus:outline-none focus:ring-2 dark:bg-slate-700 dark:text-white ${
            validationErrors.lotNumber
              ? "border-rose-500 focus:ring-rose-500/30 ring-1 ring-rose-500/30"
              : "border-gray-300 dark:border-slate-600 focus:ring-blue-500 focus:border-transparent"
          } ${!isAdmin || isSaving ? "cursor-not-allowed bg-gray-100 dark:bg-slate-800 opacity-80" : ""}`}
          placeholder="e.g. Block 1 Lot 1"
        />
        {validationErrors.lotNumber && (
          <p className="text-[11px] text-rose-500 mt-0.5 font-medium">Required</p>
        )}
      </div>

      {/* Area (SQM) */}
      <div>
        <label
          htmlFor="lot-offcanvas-area"
          className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 truncate"
          title="Area (SQM)"
        >
          Area (SQM)
        </label>
        <input
          id="lot-offcanvas-area"
          name="area_sqm"
          type="number"
          step="0.01"
          value={areaSqm}
          onChange={(e) => {
            setAreaSqm(e.target.value);
            if (validationErrors.areaSqm) {
              setValidationErrors((prev) => ({ ...prev, areaSqm: false }));
            }
          }}
          disabled={!isAdmin || isSaving}
          readOnly={!isAdmin || isSaving}
          title={!isAdmin ? "Only Admins can edit lot area" : isSaving ? "Saving..." : ""}
          className={`min-h-11 w-full rounded-lg border px-3 py-2 text-sm text-gray-900 transition-colors focus:outline-none focus:ring-2 dark:bg-slate-700 dark:text-white ${
            validationErrors.areaSqm
              ? "border-rose-500 focus:ring-rose-500/30 ring-1 ring-rose-500/30"
              : "border-gray-300 dark:border-slate-600 focus:ring-blue-500 focus:border-transparent"
          } ${!isAdmin || isSaving ? "cursor-not-allowed bg-gray-100 dark:bg-slate-800 opacity-80" : ""}`}
          placeholder="e.g. 200"
        />
        {validationErrors.areaSqm && (
          <p className="text-[11px] text-rose-500 mt-0.5 font-medium">Required</p>
        )}
      </div>
    </div>
  );
};

export default LotMetadataSection;
