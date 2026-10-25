import React, { useState, useEffect, useMemo } from "react";
import {
  loadCustomColors,
  getThemeForSubdivision,
  syncColorsFromDatabase,
} from "../../utils/subdivisionColors";
import SubdivisionColorModal from "./SubdivisionColorModal";

const LotsSoldProperties = ({
  properties,
  selectedYear,
  period = "all",
  onPeriodChange,
  isLoading = false,
  hasError = false,
  selectedPropertyId = "all",
  onSelectProperty,
}) => {
  const currentYear = new Date().getFullYear();
  const yearDisplay = selectedYear || currentYear;
  const isAllTime = period === "all";

  const [customColors, setCustomColors] = useState(() => loadCustomColors());
  const [isColorModalOpen, setIsColorModalOpen] = useState(false);

  const sortedProperties = useMemo(() => {
    if (!Array.isArray(properties)) return [];
    return [...properties].sort(
      (a, b) => Number(a.property_id || 0) - Number(b.property_id || 0)
    );
  }, [properties]);

  useEffect(() => {
    syncColorsFromDatabase();
    const handleColorUpdate = () => {
      setCustomColors(loadCustomColors());
    };
    window.addEventListener("gde-subdivision-color-changed", handleColorUpdate);
    window.addEventListener("storage", handleColorUpdate);
    return () => {
      window.removeEventListener("gde-subdivision-color-changed", handleColorUpdate);
      window.removeEventListener("storage", handleColorUpdate);
    };
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 p-6 flex flex-col justify-between h-full transition-colors duration-300">
      <div>
        <div className="flex justify-between items-center mb-6 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">Lots Sold</h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium shrink-0">
              by Subdivision
            </span>
            <button
              type="button"
              onClick={() => setIsColorModalOpen(true)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-gray-200/80 dark:border-slate-700/80 transition cursor-pointer shrink-0"
              title="Edit Subdivision Colors"
              aria-label="Edit Subdivision Colors"
            >
              <span className="text-xs">🎨</span>
            </button>
          </div>

          {/* Interactive Period Toggle: All Time vs Selected Year */}
          <div
            role="group"
            aria-label="Subdivision sales period selection"
            className="inline-flex items-center p-0.5 rounded-lg bg-gray-100 dark:bg-slate-800/90 border border-gray-200/80 dark:border-slate-700/80 shrink-0"
          >
            <button
              type="button"
              onClick={() => onPeriodChange?.("all")}
              aria-pressed={isAllTime}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-200 cursor-pointer ${
                isAllTime
                  ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => onPeriodChange?.(String(yearDisplay))}
              aria-pressed={!isAllTime}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-200 cursor-pointer ${
                !isAllTime
                  ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Year {yearDisplay}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div role="status" className="flex flex-col items-center justify-center py-8 gap-2 text-xs text-gray-500 dark:text-slate-400">
              <svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <span>Loading subdivision sales {isAllTime ? "(All Time)" : `for ${yearDisplay}`}...</span>
            </div>
          ) : hasError ? (
            <div role="alert" className="text-center py-8 text-xs text-red-600 dark:text-red-400">
              Unable to load subdivision sales. Please refresh the page.
            </div>
          ) : !properties || properties.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400">
              No subdivision property data available.
            </div>
          ) : (
            sortedProperties.map((property, index) => {
              const theme = getThemeForSubdivision(property, index, customColors);
              const total = Number(property.total) || 1;
              const sold = Number(property.sold) || 0;
              const allTimePct = Math.min(Math.round((sold / total) * 1000) / 10, 100);

              const isSelected =
                selectedPropertyId !== "all" &&
                String(selectedPropertyId) === String(property.property_id);

              return (
                <div
                  key={property.property_id || index}
                  onClick={() => onSelectProperty?.(isSelected ? "all" : property.property_id)}
                  className={`transition-all duration-200 rounded-lg p-2 -mx-2 cursor-pointer ${
                    isSelected
                      ? "bg-slate-100/70 dark:bg-slate-800/60 ring-1 ring-slate-300 dark:ring-slate-700 shadow-xs"
                      : "hover:bg-gray-50/80 dark:hover:bg-slate-800/50"
                  } ${
                    isAllTime
                      ? "space-y-2 group"
                      : "flex items-center justify-between border-b border-gray-100 dark:border-slate-800/60 last:border-0 group"
                  }`}
                  title={`Click to switch dashboard view for ${property.name}`}
                >
                  <div className="flex justify-between items-center text-xs flex-1">
                    <span className="font-medium text-gray-900 dark:text-slate-200 flex items-center gap-1.5 truncate max-w-[180px]">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm ring-1 ring-white/10"
                        style={{ backgroundColor: theme.color }}
                      />
                      <span className="truncate">{property.name}</span>
                      {isSelected && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          Active
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono text-gray-500 dark:text-slate-400 text-[11px]">
                        {isAllTime ? (
                          <>
                            <strong className="text-gray-900 dark:text-white font-semibold">{sold}</strong> of {total} Lots
                          </>
                        ) : (
                          <>
                            <strong className="text-gray-900 dark:text-white font-semibold">{sold}</strong> {sold === 1 ? "Lot" : "Lots"}
                          </>
                        )}
                      </span>
                      {isAllTime && sold > 0 && (
                        <span
                          className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-md border"
                          style={theme.style.badge}
                        >
                          {allTimePct}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar Track only visible in All Time mode */}
                  {isAllTime && (
                    <div className="w-full bg-gray-100 dark:bg-slate-800/90 border border-gray-200/50 dark:border-slate-700/40 rounded-full h-2.5 overflow-hidden p-0.5">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(allTimePct, sold > 0 ? 3 : 0)}%`,
                          ...(sold > 0 ? theme.style.bar : { backgroundColor: "transparent" }),
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
          {!isLoading && !hasError && properties && properties.length > 0 && properties.every((p) => (Number(p.sold) || 0) === 0) && (
            <div className="mt-2 text-center py-2 px-3 rounded-lg bg-gray-50 dark:bg-slate-800/60 border border-dashed border-gray-200 dark:border-slate-700/80">
              <p className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">
                {isAllTime
                  ? "No lots sold recorded across subdivisions."
                  : `No lots sold recorded for ${yearDisplay} across subdivisions.`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Subdivision Color Customizer Modal */}
      <SubdivisionColorModal
        isOpen={isColorModalOpen}
        onClose={() => setIsColorModalOpen(false)}
        subdivisions={properties || []}
        customColors={customColors}
      />
    </div>
  );
};

export default LotsSoldProperties;
