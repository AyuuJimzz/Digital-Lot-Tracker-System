import { API_BASE_URL } from "../../config/api";
import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { User, LogOut, Settings, UserCircle, MapPin, Moon, Sun } from "lucide-react";
import axios from "axios";

import { geocodeAddress } from "../../utils/geocoding";

const DEFAULT_COORDINATES_MAP = {
  1: [10.7372, 122.4998], // LOT-3896 Oton Cadastre
  2: [10.737956, 122.505478], // Lot-2018 Oton Cadestra
  3: [10.671313, 122.335284], // Lot-204 Nanga Guimbal
};

const MUNICIPALITY_COORDINATES = {
  "barotac nuevo": [10.8906, 122.7042],
  "barotac": [10.8906, 122.7042],
  "oton": [10.7372, 122.4998],
  "guimbal": [10.6713, 122.3353],
  "nanga": [10.6713, 122.3353],
  "pavia": [10.7744, 122.5408],
  "santa barbara": [10.8242, 122.5342],
  "leganes": [10.7833, 122.5833],
  "dumangas": [10.8250, 122.7167],
  "zarraga": [10.8217, 122.6108],
  "pototan": [10.9472, 122.6289],
  "janiuay": [10.9575, 122.5022],
  "miagao": [10.6444, 122.2358],
  "san joaquin": [10.5878, 122.1408],
  "tigbauan": [10.6756, 122.3811],
  "iloilo": [10.7202, 122.5621],
  "passi": [11.1075, 122.6419],
};

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

export function EmployeeHeader({ sidebarCollapsed }) {
  const [isOpen, setIsOpen] = useState(false);
  const [propertyDropdownOpen, setPropertyDropdownOpen] = useState(false);
  const [profileInitials, setProfileInitials] = useState(null);
  const dropdownRef = useRef(null);
  const propertyDropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");

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

  const getInitials = (firstName, lastName) => {
    if (!firstName && !lastName) return null;
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  // Fetch Profile data for initials
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/auth/profile`, {
          withCredentials: true,
        });
        const initials = getInitials(res.data.first_name, res.data.last_name);
        setProfileInitials(initials);
      } catch (err) {
        console.error("Failed to load user profile in employee header:", err);
      }
    };
    fetchProfile();
  }, []);

  // Dynamic Property locations (same as AdminHeader)
  const [properties, setProperties] = useState(() => {
    try {
      const cached = sessionStorage.getItem("propertiesCache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
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
    return [
      { id: 1, name: "LOT-3896 Oton Cadastre", coordinates: [10.7372, 122.4998] },
      { id: 2, name: "Lot-2018 Oton Cadestra", coordinates: [10.737956, 122.505478] },
      { id: 3, name: "Lot-204 Nanga Guimbal", coordinates: [10.671313, 122.335284] },
    ];
  });

  // Fetch dynamic properties from API
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/properties`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const mapped = data
              .filter((p) => p.status !== "inactive")
              .map((p) => ({
                id: p.property_id,
                name: p.property_name || `Property ${p.property_id}`,
                location: p.location,
                coordinates: resolvePropertyCoords(p),
              }));
            setProperties(mapped);
            try { sessionStorage.setItem("propertiesCache", JSON.stringify(data)); } catch (e) {}
          }
        }
      } catch (err) {
        console.error("Failed to load dynamic properties in employee header:", err);
      }
    };

    fetchProperties();
    window.addEventListener("propertiesUpdated", fetchProperties);
    return () => window.removeEventListener("propertiesUpdated", fetchProperties);
  }, []);

  // Check if current page is EmployeeMapView
  const isMapViewPage = location.pathname === "/employee/map-view";

  // Close dropdowns if user clicks outside of them
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

  const [selectedProperty, setSelectedProperty] = useState(() => {
    return parseInt(localStorage.getItem("selectedProperty")) || 1;
  });

  // Sync selectedProperty from localStorage on route change
  useEffect(() => {
    const saved = parseInt(localStorage.getItem("selectedProperty"));
    if (saved && saved !== selectedProperty) {
      setSelectedProperty(saved);
    }
  }, [location.pathname, selectedProperty]);

  // Listen for property selection events
  useEffect(() => {
    const handleSelectProperty = (event) => {
      const { propertyId } = event.detail;
      setSelectedProperty(propertyId);
      localStorage.setItem("selectedProperty", propertyId.toString());
    };
    window.addEventListener("selectProperty", handleSelectProperty);
    return () => window.removeEventListener("selectProperty", handleSelectProperty);
  }, []);

  const handlePropertySelect = (property) => {
    setSelectedProperty(property.id);
    // Save selected property to localStorage
    localStorage.setItem("selectedProperty", property.id.toString());

    // Emit single custom event for property selection
    window.dispatchEvent(
      new CustomEvent("selectProperty", {
        detail: { propertyId: property.id, coordinates: property.coordinates },
      })
    );

    setPropertyDropdownOpen(false);
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      localStorage.removeItem("role");
      localStorage.removeItem("authToken");
      localStorage.removeItem("password_reset_required");
      // Clear axios auth header
      const axios = (await import("axios")).default;
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
      <span className="font-medium text-gray-900 dark:text-white">Employee Panel</span>

      <div className="flex items-center gap-3">
        {/* Property Dropdown - Only show on EmployeeMapView page */}
        {isMapViewPage && (
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
                {properties.map((property, idx) => (
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
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg py-1 z-[1100]">
              <button
                className="flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-left"
                onClick={() => {
                  setIsOpen(false);
                  navigate("/employee/settings", { state: { tab: "profile" } });
                }}
              >
                <UserCircle className="mr-2 h-4 w-4 text-gray-400" />
                Profile
              </button>

              <button
                className="flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-left"
                onClick={() => {
                  setIsOpen(false);
                  navigate("/employee/settings", { state: { tab: "security" } });
                }}
              >
                <Settings className="mr-2 h-4 w-4 text-gray-400" />
                Settings
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
