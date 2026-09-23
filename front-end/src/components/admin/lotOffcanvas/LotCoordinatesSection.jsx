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
}) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Coordinates
        </span>
        {isAdmin ? (
          <div className="relative" ref={editMenuRef}>
            <button
              type="button"
              onClick={() => setIsEditMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 transition-all cursor-pointer shadow-xs"
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

            {isEditMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-xl p-2 z-50 text-xs text-gray-700 dark:text-slate-200">
                {/* Lot Classification inside Edit menu */}
                <div className="mb-2">
                  <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 px-1">
                    Lot Classification
                  </span>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700">
                    <button
                      type="button"
                      disabled={!isAdmin}
                      onClick={handleSetSaleable}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                        !isNonSaleable
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      } ${!isAdmin ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-300 inline-block" />
                      Saleable
                    </button>
                    <button
                      type="button"
                      disabled={!isAdmin}
                      onClick={handleSetNonSaleable}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                        isNonSaleable
                          ? "bg-slate-700 text-white shadow-sm ring-1 ring-slate-500/50"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      } ${!isAdmin ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                      Non-Saleable
                    </button>
                  </div>
                </div>

                <div className="my-1.5 border-t border-gray-100 dark:border-slate-700/80" />

                {showCoordinateEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditMenuOpen(false);
                      if (onStartCoordinateEdit) {
                        onStartCoordinateEdit(selectedLot);
                      }
                    }}
                    className="w-full px-2.5 py-2 rounded-lg text-left flex items-center gap-2.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 font-medium transition-colors cursor-pointer"
                  >
                    <MapPin className="w-4 h-4 shrink-0 text-blue-500" />
                    <div>
                      <div className="font-semibold">Edit Shape on Map</div>
                      <div className="text-[10px] text-gray-500 dark:text-slate-400 font-normal">
                        Adjust corners & vertices
                      </div>
                    </div>
                  </button>
                )}

                <div className="my-1.5 border-t border-gray-100 dark:border-slate-700/80" />

                <button
                  type="button"
                  onClick={() => {
                    handleCopyCoords();
                  }}
                  className="w-full px-2.5 py-2 rounded-lg text-left flex items-center gap-2.5 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  {copiedCoords ? (
                    <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4 shrink-0 text-gray-400" />
                  )}
                  <div>
                    <div className="font-medium">
                      {copiedCoords ? "Coordinates Copied!" : "Copy Lat / Lng"}
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-slate-400 font-normal">
                      Copy pin center to clipboard
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleCopyCoords}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 transition-all cursor-pointer shadow-xs"
            title="Copy coordinates to clipboard"
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
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="lot-offcanvas-latitude"
            className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5"
          >
            Latitude
          </label>
          <input
            id="lot-offcanvas-latitude"
            name="latitude"
            type="text"
            value={latitude}
            readOnly
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 cursor-not-allowed text-xs"
            placeholder="No coordinates set"
          />
        </div>
        <div>
          <label
            htmlFor="lot-offcanvas-longitude"
            className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5"
          >
            Longitude
          </label>
          <input
            id="lot-offcanvas-longitude"
            name="longitude"
            type="text"
            value={longitude}
            readOnly
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 cursor-not-allowed text-xs"
            placeholder="No coordinates set"
          />
        </div>
      </div>
    </div>
  );
};

export default LotCoordinatesSection;
