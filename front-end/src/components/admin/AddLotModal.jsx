import { API_BASE_URL } from "../../config/api";
import React, { useState, useEffect } from "react";
import { X, Plus, MapPin, Layers } from "lucide-react";
import axios from "axios";

export function AddLotModal({
  addLotModalOpen,
  setAddLotModalOpen,
  properties,
  defaultPropertyId,
  onLotCreated,
}) {
  const [propertyId, setPropertyId] = useState(defaultPropertyId || 1);
  const [lotNumber, setLotNumber] = useState("");
  const [areaSqm, setAreaSqm] = useState("");
  const [status, setStatus] = useState("Available");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Sync selected property dropdown when modal opens or defaultPropertyId changes
  useEffect(() => {
    if (addLotModalOpen && defaultPropertyId) {
      setPropertyId(defaultPropertyId);
    }
  }, [addLotModalOpen, defaultPropertyId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!lotNumber.trim()) {
      setError("Please enter a lot number");
      return;
    }
    const area = parseFloat(areaSqm);
    if (isNaN(area) || area <= 0) {
      setError("Please enter a valid area size in SQM");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/lots`,
        {
          property_id: parseInt(propertyId),
          lot_number: lotNumber.trim(),
          area_sqm: area,
          status,
        },
        { withCredentials: true }
      );

      const newLot = response.data;

      // Close modal and reset fields
      setAddLotModalOpen(false);
      resetForm();

      // Trigger map update
      if (onLotCreated) {
        onLotCreated();
      }

      // Automatically start visual coordinate editor for this new lot
      window.dispatchEvent(
        new CustomEvent("startVisualEdit", {
          detail: {
            lot_id: newLot.lot_id,
            lot_number: newLot.lot_number,
            property_id: newLot.property_id,
            coordinates: null, // Triggers default square initialization
          },
        })
      );

      // Only emit navigation event if user explicitly selected a DIFFERENT property
      if (defaultPropertyId && parseInt(propertyId) !== parseInt(defaultPropertyId)) {
        const targetCoords = properties?.find((p) => p.id === parseInt(propertyId))?.coordinates;
        if (targetCoords) {
          window.dispatchEvent(
            new CustomEvent("navigateToProperty", {
              detail: { coordinates: targetCoords },
            })
          );
        }
      }

      // Emit property selection event to update selectedProperty state in header/map
      window.dispatchEvent(
        new CustomEvent("selectProperty", {
          detail: { propertyId: parseInt(propertyId) },
        })
      );
    } catch (err) {
      console.error("Error creating lot:", err);
      setError(err.response?.data?.error || err.message || "Failed to create lot");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setLotNumber("");
    setAreaSqm("");
    setStatus("Available");
    setError("");
  };

  return (
    <>
      {addLotModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
          <div className="bg-white dark:bg-slate-900 rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl border border-gray-100 dark:border-slate-800 transition-colors">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-slate-800 pb-3">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Plus className="h-5 w-5 text-emerald-600" />
                Add New Lot
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddLotModalOpen(false);
                    window.dispatchEvent(new CustomEvent("openQuickAddLot"));
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-blue-300 dark:border-slate-700 transition-all cursor-pointer shadow-sm"
                  title="Switch to Draggable Floating Widget on Map"
                >
                  <Layers className="w-3.5 h-3.5 text-blue-500" />
                  <span>Floating Mode</span>
                </button>
                <button
                  onClick={() => setAddLotModalOpen(false)}
                  className="text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Property Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Property *
                </label>
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                >
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lot Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Lot Number / Identifier *
                </label>
                <input
                  type="text"
                  required
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  placeholder="e.g. BLOCK 1 Lot 2"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                />
              </div>

              {/* Area SQM */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Area Size (SQM) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  min="0.01"
                  value={areaSqm}
                  onChange={(e) => setAreaSqm(e.target.value)}
                  placeholder="e.g. 80.00"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Initial Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                >
                  <option value="Available">Available</option>
                  <option value="Pending">Pending</option>
                  <option value="Sold">Sold</option>
                </select>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm dark:bg-red-950/20 dark:border-red-900 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setAddLotModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-md hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white font-medium rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <MapPin className="h-4 w-4" />
                  {loading ? "Creating..." : "Save & Position"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
