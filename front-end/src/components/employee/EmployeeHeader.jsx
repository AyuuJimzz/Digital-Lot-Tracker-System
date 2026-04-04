import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { User, LogOut, Settings, UserCircle, MapPin, Moon, Sun } from "lucide-react";
import axios from "axios";

export function EmployeeHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const [propertyDropdownOpen, setPropertyDropdownOpen] = useState(false);
  const [profileInitials, setProfileInitials] = useState(null);
  const dropdownRef = useRef(null);
  const propertyDropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

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

  // Property locations (same as AdminHeader)
  const properties = [
    { id: 1, name: "Property 1", coordinates: [10.7367 + 0.0005, 122.4998] },
    { id: 2, name: "Property 2", coordinates: [10.737956000067012, 122.5054785697635] },
    { id: 3, name: "Property 3", coordinates: [10.671313434552875, 122.33628474716154] },
  ];

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

  const handlePropertySelect = (property) => {
    // Save selected property to localStorage
    localStorage.setItem("selectedProperty", property.id.toString());

    // Emit event to center the map
    window.dispatchEvent(
      new CustomEvent("navigateToProperty", {
        detail: { coordinates: property.coordinates },
      })
    );

    setPropertyDropdownOpen(false);
  };

  const handleLogout = async () => {
    try {
      await fetch("http://localhost:5000/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      setIsOpen(false);
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <header className="h-14 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between px-6 relative z-[1000] overflow-visible transition-colors duration-300">
      <span className="font-medium text-gray-900 dark:text-white">Employee Panel</span>

      <div className="flex items-center gap-3">
        {/* Property Dropdown - Only show on EmployeeMapView page */}
        {isMapViewPage && (
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
                : isOpen ? "bg-gray-200" : "bg-gray-100 hover:bg-gray-200"
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
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-[1100]">
              <button
                className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors text-left"
                onClick={() => {
                  setIsOpen(false);
                  navigate("/employee/settings", { state: { tab: "profile" } });
                }}
              >
                <UserCircle className="mr-2 h-4 w-4 text-gray-400" />
                Profile
              </button>

              <button
                className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors text-left"
                onClick={() => {
                  setIsOpen(false);
                  navigate("/employee/settings", { state: { tab: "security" } });
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
    </header>
  );
}
