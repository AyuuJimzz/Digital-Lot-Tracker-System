import React from "react";
import { Link, useLocation } from "react-router-dom";

const AccessDenied = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const status = searchParams.get("status") || "401";
  const message =
    searchParams.get("message") || "You must be logged in to access this page.";

  // Determine color: 401 → yellow, 403 → red
  const color = status === "401" ? "text-red-500" : "text-red-700";
  const bgColor = status === "401" ? "bg-yellow-200" : "bg-red-100";

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-5">
      <div
        className={`rounded-xl shadow-lg p-12 max-w-md w-full text-center sm:p-8 ${bgColor}`}
      >
        <div className={`text-[96px] mb-8 sm:text-[72px]`}>🔒</div>

        {/* Status number bigger */}
        <div className={`font-bold mb-4  text-6xl sm:text-5xl`}>{status}</div>

        {/* Message */}
        <div
          className={`text-lg font-bold mb-10 leading-relaxed sm:text-base ${color}`}
        >
          {message}
        </div>

        <Link
          to="/"
          className={`inline-block font-semibold px-10 py-4 rounded-lg shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-base ${
            status === "401"
              ? "bg-yellow-700 text-white hover:bg-yellow-800"
              : "bg-red-700 text-white hover:bg-red-800"
          }`}
        >
          Go to Login
        </Link>
      </div>
    </div>
  );
};

export default AccessDenied;
