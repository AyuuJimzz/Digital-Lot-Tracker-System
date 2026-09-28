import React from "react";

export const LotOffcanvasHeader = ({ onClose, isSaving = false }) => {
  return (
    <div className="flex items-center justify-between px-5 py-3 sm:px-6">
      <h2 className="text-lg font-bold text-gray-800 dark:text-white">Lot Details</h2>
      <button
        onClick={onClose}
        disabled={isSaving}
        className={`p-2 rounded-lg text-gray-600 dark:text-gray-300 transition-colors duration-200 ${
          isSaving
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700"
        }`}
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
