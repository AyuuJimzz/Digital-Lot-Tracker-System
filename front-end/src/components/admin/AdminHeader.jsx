import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, LogOut, Settings, UserCircle } from "lucide-react";
import axios from "axios";

export function AdminHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown if user clicks outside of it
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await axios.post(
        "http://localhost:5000/api/auth/logout",
        {},
        {
          withCredentials: true,
        },
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

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors duration-200 ${
            isOpen ? "bg-gray-200" : "bg-gray-100 hover:bg-gray-200"
          }`}
          aria-label="User profile"
        >
          <User className="h-4 w-4 text-gray-500" />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-50">
            <button
              className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors text-left"
              onClick={() => {
                console.log("Profile clicked");
                setIsOpen(false);
              }}
            >
              <UserCircle className="mr-2 h-4 w-4 text-gray-400" />
              Profile
            </button>

            <button
              className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors text-left"
              onClick={() => {
                console.log("Settings clicked");
                setIsOpen(false);
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
    </header>
  );
}
