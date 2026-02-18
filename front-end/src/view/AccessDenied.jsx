// src/pages/AccessDenied.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";

const AccessDenied = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const status = searchParams.get("status") || "403";
  const message =
    searchParams.get("message") ||
    "You do not have permission to access this page.";

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="bg-white rounded-xl shadow-2xl p-12 max-w-md w-full text-center">
        <div className="text-red-500 text-[6rem] mb-6">🔒</div>

        <div className=" text-2xl font-bold mb-2">Status: {status}</div>

        <div className="text-red-600 text-lg mb-8">{message}</div>

        <Link
          to="/"
          className="inline-block bg-yellow-600 text-white font-semibold py-3 px-8 rounded-lg shadow hover:bg-blue-500 transition-colors duration-300"
        >
          Go to Login
        </Link>
      </div>
    </div>
  );
};

export default AccessDenied;
