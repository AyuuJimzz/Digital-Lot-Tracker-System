import React from "react";
import { useLocation } from "react-router-dom";

const Forbidden = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const status = searchParams.get("status") || "403";
  const message =
    searchParams.get("message") ||
    "You do not have permission to access this page.";

  // Determine color: 401 → yellow, 403 → red
  const color = status === "401" ? "text-yellow-500" : "text-red-700";
  const bgColor = status === "401" ? "bg-yellow-100" : "bg-red-100";

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-5">
      <div
        className={`rounded-xl shadow-lg p-12 max-w-md w-full text-center sm:p-8 ${bgColor}`}
      >
        <div className="text-[96px] mb-8 sm:text-[72px]">🚫</div>
        <div className="font-bold mb-4  text-6xl sm:text-5xl">{status}</div>
        <div
          className={`font-bold text-lg mb-10 leading-relaxed sm:text-base ${color}`}
        >
          {message}
        </div>
      </div>
    </div>
  );
};

export default Forbidden;
