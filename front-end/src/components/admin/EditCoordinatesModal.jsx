import React from "react";
import { X, Save, MapPin } from "lucide-react";

export function EditCoordinatesModal({
  coordinatesModalOpen,
  setCoordinatesModalOpen,
  selectedLotId,
  setSelectedLotId,
  lotData,
  coordinates,
  loading,
  error,
  handleFetchLotData,
  handleUpdateCoordinates,
  addCoordinatePair,
  updateCoordinate,
}) {
  return (
    <>
      {coordinatesModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
          <div className="bg-white dark:bg-slate-900 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Edit Lot Coordinates
              </h2>
              <button
                onClick={() => setCoordinatesModalOpen(false)}
                className="text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Lot ID Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Lot ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={selectedLotId}
                    onChange={(e) => setSelectedLotId(e.target.value)}
                    placeholder="Enter lot ID (e.g., 1, 2, 3)"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={handleFetchLotData}
                    disabled={loading}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? "Loading..." : "Fetch"}
                  </button>
                </div>
              </div>

              {/* Lot Info Display */}
              {lotData && (
                <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-md">
                  <p className="text-sm text-gray-600 dark:text-slate-300">
                    <strong>Lot Number:</strong> {lotData.lot_number}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-slate-300">
                    <strong>Property ID:</strong> {lotData.property_id}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-slate-300">
                    <strong>Status:</strong> {lotData.status}
                  </p>
                </div>
              )}

              {/* Coordinates Inputs */}
              {lotData && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                      Coordinates
                    </label>
                    <button
                      onClick={addCoordinatePair}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                    >
                      Add Coordinate Pair
                    </button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {coordinates.map((coord, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <div className="flex-1">
                          <input
                            type="number"
                            step="any"
                            value={coord.lat}
                            onChange={(e) => updateCoordinate(index, "lat", e.target.value)}
                            placeholder={`Latitude ${index + 1}`}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 dark:text-white"
                          />
                        </div>
                        <div className="flex-1">
                          <input
                            type="number"
                            step="any"
                            value={coord.lng}
                            onChange={(e) => updateCoordinate(index, "lng", e.target.value)}
                            placeholder={`Longitude ${index + 1}`}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {coordinates.length === 0 && (
                    <p className="text-gray-500 dark:text-slate-400 text-sm text-center py-4">
                      No coordinates found. Click "Add Coordinate Pair" to add coordinates.
                    </p>
                  )}
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              {lotData && (
                <button
                  onClick={() => {
                    setCoordinatesModalOpen(false);
                    // Dispatch visual coordinate editing event
                    window.dispatchEvent(
                      new CustomEvent("startVisualEdit", {
                        detail: {
                          lot_id: lotData.lot_id,
                          lot_number: lotData.lot_number,
                          property_id: lotData.property_id,
                          coordinates: coordinates.length > 0 ? coordinates.map(c => [parseFloat(c.lat), parseFloat(c.lng)]) : null
                        }
                      })
                    );
                  }}
                  className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md transition-colors flex items-center justify-center gap-2 mb-2 shadow-sm"
                >
                  <MapPin className="h-4 w-4" />
                  Edit Visually on Map
                </button>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setCoordinatesModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-md hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateCoordinates}
                  disabled={loading || !lotData}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {loading ? "Saving..." : "Save Coordinates"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
