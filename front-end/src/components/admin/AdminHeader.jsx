import { API_BASE_URL } from "../../config/api";
import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { User, LogOut, UserCircle, MapPin, Edit, Moon, Sun, Plus, Type } from "lucide-react";
import axios from "axios";
import {
  geocodeAddress,
  MUNICIPALITY_COORDINATES,
  DEFAULT_COORDINATES_MAP,
} from "../../utils/geocoding";

// Robust coordinate resolver that checks direct coords, localStorage, town database, and geocoding
const resolvePropertyCoords = (p) => {
  if (!p) return [10.7372, 122.4998];

  // 1. Direct coordinates if already attached to property object
  if (p.coordinates && Array.isArray(p.coordinates) && p.coordinates.length >= 2) {
    if (typeof p.coordinates[0] === "number" && typeof p.coordinates[1] === "number") {
      return p.coordinates;
    }
  }

  const propId = p.property_id || p.id;

  // 2. Custom cached coordinates from localStorage
  try {
    const custom = localStorage.getItem("propertyCustomCoords_" + propId);
    if (custom) {
      const parsed = JSON.parse(custom);
      if (Array.isArray(parsed) && parsed.length >= 2) {
        return parsed;
      }
    }
  } catch (e) {}

  // 3. Known property ID map
  if (propId && DEFAULT_COORDINATES_MAP[propId]) {
    return DEFAULT_COORDINATES_MAP[propId];
  }

  // 4. Known municipality matching
  const locationText = `${p.location || ""} ${p.property_name || ""} ${p.name || ""}`.toLowerCase();
  for (const [key, coords] of Object.entries(MUNICIPALITY_COORDINATES)) {
    if (locationText.includes(key)) {
      try {
        localStorage.setItem("propertyCustomCoords_" + propId, JSON.stringify(coords));
      } catch (e) {}
      return coords;
    }
  }

  // 5. Dynamic geocoding
  if (p.location || p.property_name || p.name) {
    const query = p.location || p.property_name || p.name;
    geocodeAddress(query).then((geo) => {
      if (geo && geo.lat && geo.lng) {
        localStorage.setItem(
          "propertyCustomCoords_" + propId,
          JSON.stringify([geo.lat, geo.lng])
        );
      }
    }).catch(() => {});
  }

  return [10.7372, 122.4998];
};

export function AdminHeader({ sidebarCollapsed }) {
  const [isOpen, setIsOpen] = useState(false);
  const [propertyDropdownOpen, setPropertyDropdownOpen] = useState(false);
  const [lotsDropdownOpen, setLotsDropdownOpen] = useState(false);
  const [profileInitials, setProfileInitials] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
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
        const token = localStorage.getItem("authToken") || localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API_BASE_URL}/api/auth/profile`, {
          withCredentials: true, headers,
        });
        const initials = getInitials(res.data.first_name, res.data.last_name);
        setProfileInitials(initials);
        if (res.data) {
          try {
            sessionStorage.setItem("userProfileCache", JSON.stringify({
              first_name: res.data.first_name || "",
              last_name: res.data.last_name || "",
              email: res.data.email || "",
              phone_number: res.data.phone_number || "",
            }));
          } catch (e) {}
        }
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
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Listen for selectProperty events to keep state in sync
  useEffect(() => {
    const handleSelectProperty = (event) => {
      setSelectedProperty(event.detail.propertyId);
    };
    window.addEventListener("selectProperty", handleSelectProperty);
    return () => window.removeEventListener("selectProperty", handleSelectProperty);
  }, []);

  // Listen for modal open events triggered from map popups -> direct to Quick Add Floating window
  useEffect(() => {
    const handleOpenAddLot = () => {
      window.dispatchEvent(new CustomEvent("openQuickAddLot"));
    };

    window.addEventListener("openAddLotModal", handleOpenAddLot);

    return () => {
      window.removeEventListener("openAddLotModal", handleOpenAddLot);
    };
  }, []);

  // Sync selectedProperty from localStorage on route change
  useEffect(() => {
    const saved = parseInt(localStorage.getItem("selectedProperty"));
    if (saved && saved !== selectedProperty) {
      setSelectedProperty(saved);
    }
  }, [location.pathname, selectedProperty]);

  // Check if current page is AdminViewMap
  const isLotsMapPage = location.pathname === "/manage-lots";

  // Dynamic Property locations
  const [properties, setProperties] = useState(() => {
    try {
      const cached = sessionStorage.getItem("propertiesCache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((p) => p.status !== "inactive")
            .map((p) => ({
              id: p.property_id,
              name: p.property_name || `Property ${p.property_id}`,
              location: p.location,
              coordinates: resolvePropertyCoords(p),
            }));
        }
      }
    } catch (e) {}
    return [];
  });

  // Fetch dynamic properties from API
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API_BASE_URL}/api/properties`, { withCredentials: true, headers });
        if (Array.isArray(res.data)) {
          const mapped = res.data
            .filter((p) => p.status !== "inactive")
            .map((p) => ({
              id: p.property_id,
              name: p.property_name || `Property ${p.property_id}`,
              location: p.location,
              coordinates: resolvePropertyCoords(p),
            }));
          setProperties(mapped);
          try { sessionStorage.setItem("propertiesCache", JSON.stringify(res.data)); } catch (e) {}
        }
      } catch (err) {
        console.error("Failed to load dynamic properties in header:", err);
      }
    };

    fetchProperties();
    window.addEventListener("propertiesUpdated", fetchProperties);
    return () => window.removeEventListener("propertiesUpdated", fetchProperties);
  }, []);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const handleToggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  // Handle property selection
  const handlePropertySelect = (property) => {
    setSelectedProperty(property.id);
    localStorage.setItem("selectedProperty", property.id.toString());

    // Emit single custom event to map component for property selection
    window.dispatchEvent(
      new CustomEvent("selectProperty", {
        detail: { propertyId: property.id, coordinates: property.coordinates },
      })
    );

    setPropertyDropdownOpen(false);
  };

  const handleLogout = async () => {
    const token = localStorage.getItem("authToken");
    const role = localStorage.getItem("role") || "admin";
    try {
      await axios.post(
        `${API_BASE_URL}/api/auth/logout`,
        { role },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          withCredentials: true,
        }
      );
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      localStorage.removeItem("role");
      localStorage.removeItem("authToken");
      localStorage.removeItem("password_reset_required");
      delete axios.defaults.headers.common["Authorization"];
      setIsOpen(false);
      navigate("/", { replace: true });
    }
  };

  return (
    <header
      className="fixed top-0 right-0 h-14 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between px-4 sm:px-6 z-30 overflow-visible transition-all duration-300"
      style={{ left: sidebarCollapsed ? "4rem" : "14rem" }}
    >
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
                  className="flex w-full items-center px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-left border-t border-gray-100 dark:border-slate-700 cursor-pointer"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("openQuickAddLot"));
                    setLotsDropdownOpen(false);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Add New Lot
                </button>
                <button
                  className="flex w-full items-center px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-left border-t border-gray-100 dark:border-slate-700 cursor-pointer"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("openAnnotationPanel"));
                    setLotsDropdownOpen(false);
                  }}
                >
                  <Type className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Road & Map Labels
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
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors duration-200 max-w-[240px] truncate ${
                propertyDropdownOpen
                  ? "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-slate-700 dark:text-blue-300 dark:border-slate-600"
                  : "bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700"
              }`}
              title="Select Property / Location"
            >
              <MapPin className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
              {properties.find((p) => p.id === selectedProperty) ? (
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-200/70 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-bold shrink-0">
                    #{properties.findIndex((p) => p.id === selectedProperty) + 1 || 1}
                  </span>
                  <span className="truncate font-medium">
                    {properties.find((p) => p.id === selectedProperty)?.name}
                  </span>
                </div>
              ) : (
                <span className="truncate font-medium">Properties</span>
              )}
            </button>

            {/* Property Dropdown Menu */}
            {propertyDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg py-1 z-[9999]">
                {properties.length > 0 ? (
                  properties.map((property, idx) => (
                    <button
                      key={property.id}
                      className={`flex w-full items-center gap-2 px-3.5 py-2 text-xs sm:text-sm transition-colors text-left ${
                        property.id === selectedProperty
                          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold"
                          : "text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                      }`}
                      onClick={() => handlePropertySelect(property)}
                    >
                      <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="px-1.5 py-0.5 text-[11px] font-bold rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="truncate">{property.name}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-3.5 py-2.5 text-xs text-gray-400 dark:text-slate-400 text-center">
                    No properties found
                  </div>
                )}
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
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg py-1 z-[9999]">
              <button
                className="flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-left"
                onClick={() => {
                  setIsOpen(false);
                  navigate("/settings");
                }}
              >
                <UserCircle className="mr-2 h-4 w-4 text-gray-400" />
                Profile & Settings
              </button>

              <div className="border-t border-gray-100 dark:border-slate-700 my-1"></div>

              <button
                className="flex w-full items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-left"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

    </header>
  );
}
