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
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-5">
      <div className="bg-white rounded-xl shadow-lg p-12 max-w-md w-full text-center sm:p-8">
        <div className="text-[96px] mb-8 text-red-700 sm:text-[72px]">🔒</div>
        <div className="text-2xl font-bold mb-4 text-gray-800 sm:text-xl">
          Status: {status}
        </div>
        <div className="text-lg text-red-700 mb-10 leading-relaxed sm:text-base">
          {message}
        </div>
        <Link
          to="/"
          className="inline-block bg-yellow-700 text-white font-semibold px-10 py-4 rounded-lg shadow-md transition-all duration-300 hover:bg-yellow-800 hover:-translate-y-1 hover:shadow-xl text-base"
        >
          Go to Login
        </Link>
      </div>
    </div>
  );
};

export default AccessDenied;
