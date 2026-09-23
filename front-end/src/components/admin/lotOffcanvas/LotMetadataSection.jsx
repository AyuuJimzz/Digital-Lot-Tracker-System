import React from "react";
import { checkIsNonSaleable, stripNonSaleableTags } from "./lotOffcanvasUtils";

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
}) => {
  return (
    <>
      {/* Lot Number */}
      <div>
        <label
          htmlFor="lot-offcanvas-lot-number"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
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
          disabled={!isAdmin}
          readOnly={!isAdmin}
          title={!isAdmin ? "Only Admins can edit lot number" : ""}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 dark:text-white dark:bg-slate-700 font-semibold transition-colors ${
            validationErrors.lotNumber
              ? "border-rose-500 focus:ring-rose-500/30 ring-1 ring-rose-500/30"
              : "border-gray-300 dark:border-slate-600 focus:ring-blue-500 focus:border-transparent"
          } ${!isAdmin ? "cursor-not-allowed bg-gray-100 dark:bg-slate-800 opacity-80" : ""}`}
          placeholder="e.g. BLOCK 7 Lot 1"
        />
        {validationErrors.lotNumber && (
          <p className="text-[11px] text-rose-500 mt-1 font-medium">Lot number is required</p>
        )}
        {isAdmin && !isNonSaleable && checkIsNonSaleable(lotNumber) && (
          <button
            type="button"
            onClick={() => {
              const cleaned = stripNonSaleableTags(lotNumber);
              setLotNumber(cleaned);
              if (onLiveLotUpdate && selectedLot) {
                onLiveLotUpdate({
                  lot_id: selectedLot.lot_id,
                  lot_number: cleaned,
                  status: status || "Available",
                  is_non_saleable: false,
                });
              }
            }}
            className="mt-1 text-left text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
          >
            ✨ Click to remove non-saleable tag from name
          </button>
        )}
      </div>

      {/* Area (SQM) */}
      <div>
        <label
          htmlFor="lot-offcanvas-area"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
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
          disabled={!isAdmin}
          readOnly={!isAdmin}
          title={!isAdmin ? "Only Admins can edit lot area" : ""}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 dark:text-white dark:bg-slate-700 transition-colors ${
            validationErrors.areaSqm
              ? "border-rose-500 focus:ring-rose-500/30 ring-1 ring-rose-500/30"
              : "border-gray-300 dark:border-slate-600 focus:ring-blue-500 focus:border-transparent"
          } ${!isAdmin ? "cursor-not-allowed bg-gray-100 dark:bg-slate-800 opacity-80" : ""}`}
          placeholder="e.g. 200"
        />
        {validationErrors.areaSqm && (
          <p className="text-[11px] text-rose-500 mt-1 font-medium">Area is required</p>
        )}
      </div>
    </>
  );
};

export default LotMetadataSection;
