import React from "react";

export const LotOffcanvasHeader = ({ onClose }) => {
  return (
    <div className="flex items-center justify-between px-6 pt-5 pb-2">
      <h2 className="text-xl font-bold text-gray-800 dark:text-white">Lot Details</h2>
      <button
        onClick={onClose}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 transition-colors duration-200 cursor-pointer"
        aria-label="Close"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
};

export default LotOffcanvasHeader;
