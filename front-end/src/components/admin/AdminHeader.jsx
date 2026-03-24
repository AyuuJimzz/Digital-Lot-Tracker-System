import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { User, LogOut, Settings, UserCircle, MapPin } from "lucide-react";
import axios from "axios";

export function AdminHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const [propertyDropdownOpen, setPropertyDropdownOpen] = useState(false);
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

  // Check if current page is LotsMap
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

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 relative">
      <span className="font-medium text-gray-900">Admin Panel</span>

      <div className="flex items-center gap-3">
        {/* Property Dropdown - Only show on LotsMap page */}
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
    </header>
  );
}
