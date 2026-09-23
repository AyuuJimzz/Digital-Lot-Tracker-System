import React from "react";

export const LotOffcanvasFooter = ({
  isLockedForUser,
  isSaving,
  isDeleting,
  isDeletingLot,
  handleSave,
  isAdmin,
  openDeleteModal,
  selectedLot,
}) => {
  return (
    <div className="p-6 border-t border-gray-200 dark:border-slate-700">
      <div className="flex flex-col gap-2">
        {!isLockedForUser ? (
          <button
            className={`w-full py-2 px-4 rounded-lg transition-colors duration-200 font-medium cursor-pointer ${
              isSaving
                ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
            onClick={handleSave}
            disabled={isSaving || isDeleting}
          >
            {isSaving ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Saving...
              </span>
            ) : (
              "Save"
            )}
          </button>
        ) : (
          <div className="w-full py-2.5 px-4 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 text-xs font-medium text-center border border-gray-200 dark:border-slate-700">
            🔒 Sold Lot — View Only (Only Admins can modify)
          </div>
        )}

        {isAdmin && (
          <button
            className={`w-full py-2 px-4 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors duration-200 font-medium cursor-pointer ${
              isDeleting ? "cursor-not-allowed opacity-50" : ""
            }`}
            onClick={() => openDeleteModal(selectedLot)}
            disabled={isSaving || isDeletingLot}
          >
            {isDeleting ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-red-600 dark:text-red-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Deleting...
              </span>
            ) : (
              "Delete Lot"
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default LotOffcanvasFooter;
