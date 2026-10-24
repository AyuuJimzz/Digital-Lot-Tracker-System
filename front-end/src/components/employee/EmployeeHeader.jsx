import { API_BASE_URL } from "../../config/api";
import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { User, MapPin, Moon, Sun } from "lucide-react";
import axios from "axios";
import { clearStoredAuth } from "../../utils/authStorage";
import { AccountMenu } from "../AccountMenu";
import { showToast } from "../GlobalToast";

import {
  geocodeAddress,
  getPropertyFallbackCoordinates,
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

  // 3. Use the actual address, never an assumed database ID.
  const fallback = getPropertyFallbackCoordinates(propId, p.location, p.property_name || p.name);
  if (fallback[0] !== 10.7202 || fallback[1] !== 122.5621) return fallback;

  // 5. Dynamic geocoding
  if (p.location || p.property_name || p.name) {
    const query = p.location || p.property_name || p.name;
    geocodeAddress(query).then((geo) => {
      if (geo && geo.lat && geo.lng) {
        try {
          if (!localStorage.getItem("propertyCustomCoords_" + propId)) {
            localStorage.setItem("propertyCustomCoords_" + propId, JSON.stringify([geo.lat, geo.lng]));
          }
        } catch (e) {}
      }
    }).catch(() => {});
  }

  return fallback;
};

export function EmployeeHeader({ sidebarCollapsed }) {
  const [isOpen, setIsOpen] = useState(false);
  const [propertyDropdownOpen, setPropertyDropdownOpen] = useState(false);
  const [isLotDrawerOpen, setIsLotDrawerOpen] = useState(false);
  const [profileInitials, setProfileInitials] = useState(null);
  const dropdownRef = useRef(null);
  const propertyDropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
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
        const token = localStorage.getItem("authToken") || localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API_BASE_URL}/api/auth/profile`, {
          headers,
          withCredentials: true,
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
            const storedUser = localStorage.getItem("user");
            if (storedUser) {
              const parsed = JSON.parse(storedUser);
              localStorage.setItem("user", JSON.stringify({
                ...parsed,
                first_name: res.data.first_name || parsed.first_name || "",
                last_name: res.data.last_name || parsed.last_name || "",
                name: `${res.data.first_name || ""} ${res.data.last_name || ""}`.trim() || parsed.name || "",
              }));
            }
          } catch (e) {}
        }
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
        const token = localStorage.getItem("authToken") || localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API_BASE_URL}/api/properties`, {
          headers,
          withCredentials: true,
        });
        const data = res.data;
        if (Array.isArray(data)) {
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
          if (mapped.length > 0) {
            setSelectedProperty((prev) => {
              const currentSaved = parseInt(localStorage.getItem("selectedProperty"));
              const activeId = !isNaN(currentSaved) && currentSaved > 0 ? currentSaved : prev;
              const isCurrentValid = mapped.some((p) => Number(p.id) === Number(activeId));
              if (!isCurrentValid) {
                localStorage.setItem("selectedProperty", mapped[0].id.toString());
                return mapped[0].id;
              }
              return activeId;
            });
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

  // Close dropdowns if user clicks outside of them (with Touch support for iPad)
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
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
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

  // Listen for lot drawer open/close state to prevent switching locations while editing/viewing a lot
  useEffect(() => {
    const handleLotDrawerState = (event) => {
      const open = Boolean(event.detail?.isOpen);
      setIsLotDrawerOpen(open);
      if (open) {
        setPropertyDropdownOpen(false);
      }
    };
    window.addEventListener("lotDrawerStateChange", handleLotDrawerState);
    return () => window.removeEventListener("lotDrawerStateChange", handleLotDrawerState);
  }, []);

  useEffect(() => {
    setIsLotDrawerOpen(false);
  }, [location.pathname]);

  const handlePropertySelect = (property) => {
    if (isLotDrawerOpen) {
      showToast("Please close or save the lot details drawer before switching location.", "warning");
      return;
    }
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
    const token = localStorage.getItem("authToken");
    const role = localStorage.getItem("role") || "employee";
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ role }),
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      clearStoredAuth();
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
              type="button"
              onClick={() => {
                if (isLotDrawerOpen) {
                  showToast("Please close or save the lot details drawer before switching location.", "warning");
                  return;
                }
                setPropertyDropdownOpen(!propertyDropdownOpen);
              }}
              disabled={isLotDrawerOpen}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors duration-200 max-w-[240px] truncate ${
                isLotDrawerOpen
                  ? "cursor-not-allowed opacity-60 bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700 select-none"
                  : propertyDropdownOpen
                  ? "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-slate-700 dark:text-blue-300 dark:border-slate-600"
                  : "bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700"
              }`}
              title={
                isLotDrawerOpen
                  ? "Close the lot details drawer before switching property location"
                  : "Select Property / Location"
              }
            >
              <MapPin className={`h-4 w-4 shrink-0 ${isLotDrawerOpen ? "text-gray-400 dark:text-slate-500" : "text-blue-600 dark:text-blue-400"}`} />
              {properties.find((p) => Number(p.id) === Number(selectedProperty)) ? (
                <div className="flex items-center gap-1.5 truncate">
                  <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                    isLotDrawerOpen
                      ? "bg-gray-200/80 dark:bg-slate-700 text-gray-500 dark:text-slate-400"
                      : "bg-blue-200/70 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300"
                  }`}>
                    #{properties.findIndex((p) => Number(p.id) === Number(selectedProperty)) + 1 || 1}
                  </span>
                  <span className="truncate font-medium">
                    {properties.find((p) => Number(p.id) === Number(selectedProperty))?.name}
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
                      Number(property.id) === Number(selectedProperty)
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
            aria-expanded={isOpen}
            aria-haspopup="true"
          >
            {profileInitials ? (
              <span className="text-white text-xs font-bold tracking-wider">{profileInitials}</span>
            ) : (
              <User className="h-4 w-4 text-gray-500" />
            )}
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <AccountMenu
              onSettings={() => {
                setIsOpen(false);
                navigate("/employee/settings");
              }}
              onLogout={handleLogout}
            />
          )}
        </div>
      </div>
    </header>
  );
}
