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
  if (isLockedForUser && !isAdmin) return null;

  return (
    <div className="border-t border-gray-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-800 sm:px-6">
      <div className="flex flex-col gap-2">
        <button
          className={`min-h-11 w-full rounded-xl px-4 py-2 font-semibold transition-colors duration-200 ${
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
              "Save changes"
            )}
        </button>

        {isAdmin && (
          <button
            className={`min-h-11 w-full rounded-xl border border-red-200 px-4 py-2 font-medium text-red-600 transition-colors duration-200 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30 ${
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
