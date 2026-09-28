import React from "react";
import { Edit3, ChevronDown, MapPin, Copy, Check } from "lucide-react";

export const LotCoordinatesSection = ({
  latitude,
  longitude,
  isAdmin,
  editMenuRef,
  isEditMenuOpen,
  setIsEditMenuOpen,
  isNonSaleable,
  handleSetSaleable,
  handleSetNonSaleable,
  showCoordinateEdit,
  onStartCoordinateEdit,
  selectedLot,
  handleCopyCoords,
  copiedCoords,
  isSaving = false,
}) => {
  const hasCoordinates = latitude !== null && latitude !== undefined && latitude !== "" &&
    longitude !== null && longitude !== undefined && longitude !== "";

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Coordinates
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopyCoords}
            disabled={!hasCoordinates || isSaving}
            aria-label="Copy lot coordinates"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-xs ${
              copiedCoords
                ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30"
                : "bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border-gray-200 dark:border-slate-700"
            } ${!hasCoordinates || isSaving ? "cursor-not-allowed opacity-50" : ""}`}
            title={
              hasCoordinates
                ? `${latitude}, ${longitude} (Click to copy)`
                : "No coordinates available"
            }
          >
            {copiedCoords ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                <span>Copy</span>
              </>
            )}
          </button>

          {isAdmin && (
            <div className="relative" ref={editMenuRef}>
              <button
                type="button"
                onClick={() => setIsEditMenuOpen((prev) => !prev)}
                disabled={isSaving}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 transition-all cursor-pointer shadow-xs ${
                  isSaving ? "opacity-60 cursor-not-allowed pointer-events-none" : ""
                }`}
                aria-haspopup="true"
                aria-expanded={isEditMenuOpen}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
                <ChevronDown
                  className={`w-3 h-3 transition-transform duration-150 ${
                    isEditMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isEditMenuOpen && !isSaving && (
                <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-xl p-2 z-50 text-xs text-gray-700 dark:text-slate-200">
                  {/* Lot Classification inside Edit menu */}
                  <div className="mb-2">
                    <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 px-1">
                      Lot Classification
                    </span>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700">
                      <button
                        type="button"
                        disabled={!isAdmin || isSaving}
                        onClick={isSaving ? undefined : handleSetSaleable}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                          !isNonSaleable
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        } ${!isAdmin || isSaving ? "opacity-60 cursor-not-allowed pointer-events-none" : ""}`}
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-300 inline-block" />
                        Saleable
                      </button>
                      <button
                        type="button"
                        disabled={!isAdmin || isSaving}
                        onClick={isSaving ? undefined : handleSetNonSaleable}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                          isNonSaleable
                            ? "bg-slate-700 text-white shadow-sm ring-1 ring-slate-500/50"
                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        } ${!isAdmin || isSaving ? "opacity-60 cursor-not-allowed pointer-events-none" : ""}`}
                      >
                        <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                        Non-Saleable
                      </button>
                    </div>
                  </div>

                  {showCoordinateEdit && (
                    <>
                      <div className="my-1.5 border-t border-gray-100 dark:border-slate-700/80" />
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => {
                          if (isSaving) return;
                          setIsEditMenuOpen(false);
                          if (onStartCoordinateEdit) {
                            onStartCoordinateEdit(selectedLot);
                          }
                        }}
                        className={`w-full px-2.5 py-2 rounded-lg text-left flex items-center gap-2.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 font-medium transition-colors cursor-pointer ${
                          isSaving ? "opacity-60 cursor-not-allowed pointer-events-none" : ""
                        }`}
                      >
                        <MapPin className="w-4 h-4 shrink-0 text-blue-500" />
                        <div>
                          <div className="font-semibold">Edit Shape on Map</div>
                          <div className="text-[10px] text-gray-500 dark:text-slate-400 font-normal">
                            Adjust corners & vertices
                          </div>
                        </div>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate" title={hasCoordinates ? `${latitude}, ${longitude}` : undefined}>
          {hasCoordinates ? `${latitude}, ${longitude}` : "No location pin set"}
        </span>
      </div>
    </div>
  );
};

export default LotCoordinatesSection;
