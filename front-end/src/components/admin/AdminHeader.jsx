import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { User, LogOut, Settings, UserCircle, MapPin, Edit, Moon, Sun, Plus } from "lucide-react";
import axios from "axios";
import { EditCoordinatesModal } from "./EditCoordinatesModal";
import { AddLotModal } from "./AddLotModal";

export function AdminHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const [propertyDropdownOpen, setPropertyDropdownOpen] = useState(false);
  const [lotsDropdownOpen, setLotsDropdownOpen] = useState(false); // dropdown state for Manage Lots
  const [coordinatesModalOpen, setCoordinatesModalOpen] = useState(false);
  const [addLotModalOpen, setAddLotModalOpen] = useState(false);
  const [selectedLotId, setSelectedLotId] = useState("");
  const [lotData, setLotData] = useState(null);
  const [coordinates, setCoordinates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [profileInitials, setProfileInitials] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [selectedProperty, setSelectedProperty] = useState(() => {
    return parseInt(localStorage.getItem("selectedProperty")) || 1;
  });
  const dropdownRef = useRef(null);
  const propertyDropdownRef = useRef(null);
  const lotsDropdownRef = useRef(null); // ref for Manage Lots dropdown
  const navigate = useNavigate();
  const location = useLocation();

  const getInitials = (firstName, lastName) => {
    if (!firstName && !lastName) return null;
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  // Fetch Profile data for initials
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/auth/profile", {
          withCredentials: true,
        });
        const initials = getInitials(res.data.first_name, res.data.last_name);
        setProfileInitials(initials);
      } catch (err) {
        console.error("Failed to load profile for header", err);
      }
    };
    fetchProfile();
  }, [location.pathname]); // Re-fetch occasionally when navigating

  // Close dropdown if user clicks outside of it
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
      if (propertyDropdownRef.current && !propertyDropdownRef.current.contains(event.target)) {
        setPropertyDropdownOpen(false);
      }
      if (lotsDropdownRef.current && !lotsDropdownRef.current.contains(event.target)) {
        setLotsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Listen for selectProperty events to keep state in sync
  useEffect(() => {
    const handleSelectProperty = (event) => {
      setSelectedProperty(event.detail.propertyId);
    };
    window.addEventListener("selectProperty", handleSelectProperty);
    return () => window.removeEventListener("selectProperty", handleSelectProperty);
  }, []);

  // Check if current page is AdminViewMap
  const isLotsMapPage = location.pathname === "/manage-lots";

  // Property locations
  const properties = [
    { id: 1, name: "Property 1", coordinates: [10.7367 + 0.0005, 122.4998] },
    { id: 2, name: "Property 2", coordinates: [10.737956000067012, 122.5054785697635] },
    { id: 3, name: "Property 3", coordinates: [10.671313434552875, 122.33528474716154] },
  ];

  const handleToggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Handle property selection
  const handlePropertySelect = (property) => {
    setSelectedProperty(property.id);

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

  const updateCoordinate = (index, field, value) => {
    const newCoordinates = [...coordinates];
    newCoordinates[index][field] = value;
    setCoordinates(newCoordinates);
  };

  return (
    <header className="fixed top-0 left-56 right-0 h-14 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between px-6 z-30 overflow-visible transition-colors duration-300">
      <span className="font-medium text-gray-900 dark:text-white">Admin Panel</span>

      <div className="flex items-center gap-3">
        {/* Manage Lots Dropdown - Combines Site Plan, Add Lot, & Edit Coordinates */}
        {isLotsMapPage && (
          <div className="relative" ref={lotsDropdownRef}>
            <button
              onClick={() => setLotsDropdownOpen(!lotsDropdownOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 border ${
                lotsDropdownOpen
                  ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-slate-700 dark:text-blue-300 dark:border-slate-600"
                  : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
              }`}
            >
              <Edit className="h-4 w-4" />
              Manage Lots
            </button>

            {/* Dropdown Menu */}
            {lotsDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-[9999] dark:bg-slate-800 dark:border-slate-700">
                <button
                  className="flex w-full items-center px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-left"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("openOverlayPanel"));
                    setLotsDropdownOpen(false);
                  }}
                >
                  <span className="mr-2 text-purple-600 dark:text-purple-400">📎</span>
                  Site Plan Overlay
                </button>
                <button
                  className="flex w-full items-center px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-left border-t border-gray-100 dark:border-slate-700"
                  onClick={() => {
                    setAddLotModalOpen(true);
                    setLotsDropdownOpen(false);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Add New Lot
                </button>
                <button
                  className="flex w-full items-center px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-left border-t border-gray-100 dark:border-slate-700"
                  onClick={() => {
                    openCoordinatesModal();
                    setLotsDropdownOpen(false);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Edit Coordinates (Manual)
                </button>
              </div>
            )}
          </div>
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

        {/* Global Theme Toggle Button */}
        <button
          onClick={handleToggleTheme}
          className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700 transition-colors"
          title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
        >
          {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`h-9 w-9 rounded-full flex items-center justify-center transition-transform hover:scale-105 duration-200 overflow-hidden ${
              profileInitials
                ? "bg-gradient-to-tr from-amber-500 to-orange-400 shadow-sm"
                : isOpen
                  ? "bg-gray-200"
                  : "bg-gray-100 hover:bg-gray-200"
            }`}
            aria-label="User profile"
          >
            {profileInitials ? (
              <span className="text-white text-xs font-bold tracking-wider">{profileInitials}</span>
            ) : (
              <User className="h-4 w-4 text-gray-500" />
            )}
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-[9999]">
              <button
                className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors text-left"
                onClick={() => {
                  setIsOpen(false);
                  navigate("/settings", { state: { tab: "profile" } });
                }}
              >
                <UserCircle className="mr-2 h-4 w-4 text-gray-400" />
                Profile
              </button>

              <button
                className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors text-left"
                onClick={() => {
                  setIsOpen(false);
                  navigate("/settings", { state: { tab: "security" } });
                }}
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

      <EditCoordinatesModal
        coordinatesModalOpen={coordinatesModalOpen}
        setCoordinatesModalOpen={setCoordinatesModalOpen}
        selectedLotId={selectedLotId}
        setSelectedLotId={setSelectedLotId}
        lotData={lotData}
        coordinates={coordinates}
        loading={loading}
        error={error}
        handleFetchLotData={handleFetchLotData}
        handleUpdateCoordinates={handleUpdateCoordinates}
        addCoordinatePair={addCoordinatePair}
        updateCoordinate={updateCoordinate}
      />

      <AddLotModal
        addLotModalOpen={addLotModalOpen}
        setAddLotModalOpen={setAddLotModalOpen}
        properties={properties}
        defaultPropertyId={selectedProperty}
        onLotCreated={() => {
          // Emit event to refresh map data
          window.dispatchEvent(new CustomEvent("refreshMapData"));
        }}
      />
    </header>
  );
}
