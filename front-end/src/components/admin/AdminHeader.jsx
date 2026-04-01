import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { User, LogOut, Settings, UserCircle, MapPin, Edit, X, Save } from "lucide-react";
import axios from "axios";

export function AdminHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const [propertyDropdownOpen, setPropertyDropdownOpen] = useState(false);
  const [coordinatesModalOpen, setCoordinatesModalOpen] = useState(false);
  const [selectedLotId, setSelectedLotId] = useState("");
  const [lotData, setLotData] = useState(null);
  const [coordinates, setCoordinates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const dropdownRef = useRef(null);
  const propertyDropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Close dropdown if user clicks outside of it
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
      if (propertyDropdownRef.current && !propertyDropdownRef.current.contains(event.target)) {
        setPropertyDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Check if current page is AdminViewMap
  const isLotsMapPage = location.pathname === "/manage-lots";

  // Property locations
  const properties = [
    { id: 1, name: "Property 1", coordinates: [10.7367 + 0.0005, 122.4998] },
    { id: 2, name: "Property 2", coordinates: [10.737956000067012, 122.5054785697635] },
    { id: 3, name: "Property 3", coordinates: [10.671313434552875, 122.33628474716154] },
  ];

  // Handle property selection
  const handlePropertySelect = (property) => {
    // Emit custom event to map component for navigation
    window.dispatchEvent(
      new CustomEvent("navigateToProperty", {
        detail: { coordinates: property.coordinates },
      })
    );

    // Emit custom event to map component for property filtering
    window.dispatchEvent(
      new CustomEvent("selectProperty", {
        detail: { propertyId: property.id },
      })
    );

    setPropertyDropdownOpen(false);
  };

  const handleLogout = async () => {
    try {
      await axios.post(
        "http://localhost:5000/api/auth/logout",
        {},
        {
          withCredentials: true,
        }
      );

      setIsOpen(false);
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
      setIsOpen(false);
      navigate("/", { replace: true });
    }
  };

  const handleFetchLotData = async () => {
    if (!selectedLotId.trim()) {
      setError("Please enter a lot ID");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await axios.get(`http://localhost:5000/api/lots/${selectedLotId.trim()}`);
      const lot = response.data;
      setLotData(lot);

      if (lot.coordinates) {
        const coords =
          typeof lot.coordinates === "string" ? JSON.parse(lot.coordinates) : lot.coordinates;
        // Handle both single coordinate and polygon coordinates
        if (Array.isArray(coords) && coords.length > 0) {
          if (typeof coords[0] === "number") {
            // Single coordinate [lat, lng]
            setCoordinates([{ lat: coords[0].toString(), lng: coords[1].toString() }]);
          } else if (Array.isArray(coords[0])) {
            // Polygon coordinates [[lat1, lng1], [lat2, lng2], ...]
            setCoordinates(
              coords.map((coord) => ({
                lat: coord[0].toString(),
                lng: coord[1].toString(),
              }))
            );
          }
        } else {
          setCoordinates([]);
        }
      } else {
        setCoordinates([]);
      }
    } catch (error) {
      setError("Lot not found or error fetching data");
      setLotData(null);
      setCoordinates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCoordinates = async () => {
    if (!selectedLotId.trim()) {
      setError("Please enter a lot ID");
      return;
    }

    if (coordinates.length === 0) {
      setError("Please add at least one coordinate pair");
      return;
    }

    // Validate all coordinates
    const validatedCoords = coordinates.map((coord) => {
      const lat = parseFloat(coord.lat);
      const lng = parseFloat(coord.lng);
      if (isNaN(lat) || isNaN(lng)) {
        throw new Error("All coordinates must be valid numbers");
      }
      return [lat, lng];
    });

    setLoading(true);
    setError("");

    try {
      await axios.put(`http://localhost:5000/api/lots/${selectedLotId.trim()}/coordinates`, {
        coordinates: validatedCoords,
      });

      // Show success message
      alert("Coordinates updated successfully!");

      // Emit custom event to refresh map data
      window.dispatchEvent(
        new CustomEvent("refreshMapData", {
          detail: { lotId: selectedLotId.trim() },
        })
      );

      setCoordinatesModalOpen(false);
      resetModal();
    } catch (error) {
      setError(error.response?.data?.error || error.message || "Failed to update coordinates");
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setSelectedLotId("");
    setLotData(null);
    setCoordinates([]);
    setError("");
  };

  const openCoordinatesModal = () => {
    resetModal();
    setCoordinatesModalOpen(true);
  };

  const addCoordinatePair = () => {
    setCoordinates([...coordinates, { lat: "", lng: "" }]);
  };

  const removeCoordinatePair = (index) => {
    const newCoordinates = coordinates.filter((_, i) => i !== index);
    setCoordinates(newCoordinates);
  };

  const updateCoordinate = (index, field, value) => {
    const newCoordinates = [...coordinates];
    newCoordinates[index][field] = value;
    setCoordinates(newCoordinates);
  };

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 relative">
      <span className="font-medium text-gray-900">Admin Panel</span>

      <div className="flex items-center gap-3">
        {/* Edit Coordinates Button - Only show on AdminViewMap page */}
        {isLotsMapPage && (
          <button
            onClick={openCoordinatesModal}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
          >
            <Edit className="h-4 w-4" />
            Edit Coordinates
          </button>
        )}

        {/* Property Dropdown - Only show on AdminViewMap page */}
        {isLotsMapPage && (
          <div className="relative" ref={propertyDropdownRef}>
            <button
              onClick={() => setPropertyDropdownOpen(!propertyDropdownOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors duration-200 ${
                propertyDropdownOpen
                  ? "bg-blue-100 text-blue-700 border border-blue-200"
                  : "bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
              }`}
            >
              <MapPin className="h-4 w-4" />
              Properties
            </button>

            {/* Property Dropdown Menu */}
            {propertyDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-[9999]">
                {properties.map((property) => (
                  <button
                    key={property.id}
                    className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors text-left"
                    onClick={() => handlePropertySelect(property)}
                  >
                    <MapPin className="mr-2 h-4 w-4 text-gray-400" />
                    {property.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors duration-200 ${isOpen ? "bg-gray-200" : "bg-gray-100 hover:bg-gray-200"}`}
            aria-label="User profile"
          >
            <User className="h-4 w-4 text-gray-500" />
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-[9999]">
              <button
                className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors text-left"
                onClick={() => setIsOpen(false)}
              >
                <UserCircle className="mr-2 h-4 w-4 text-gray-400" />
                Profile
              </button>

              <button
                className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors text-left"
                onClick={() => setIsOpen(false)}
              >
                <Settings className="mr-2 h-4 w-4 text-gray-400" />
                Settings
              </button>

              <div className="border-t border-gray-100 my-1"></div>

              <button
                className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Coordinates Modal */}
      {coordinatesModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Edit Lot Coordinates</h2>
              <button
                onClick={() => setCoordinatesModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Lot ID Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lot ID</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={selectedLotId}
                    onChange={(e) => setSelectedLotId(e.target.value)}
                    placeholder="Enter lot ID (e.g., 1, 2, 3)"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm text-gray-600">
                    <strong>Lot Number:</strong> {lotData.lot_number}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Property ID:</strong> {lotData.property_id}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Status:</strong> {lotData.status}
                  </p>
                </div>
              )}

              {/* Coordinates Inputs */}
              {lotData && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">Coordinates</label>
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <div className="flex-1">
                          <input
                            type="number"
                            step="any"
                            value={coord.lng}
                            onChange={(e) => updateCoordinate(index, "lng", e.target.value)}
                            placeholder={`Longitude ${index + 1}`}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {coordinates.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-4">
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
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setCoordinatesModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
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
    </header>
  );
}
