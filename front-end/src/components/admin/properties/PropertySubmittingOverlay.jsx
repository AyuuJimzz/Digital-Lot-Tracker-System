import React from "react";
import { MapPin } from "lucide-react";

const PropertySubmittingOverlay = ({
  isSubmitting,
  editingProperty,
  submitStatus,
}) => {
  if (!isSubmitting) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-sm w-full text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
        {/* Animated Radar/Spinner */}
        <div className="relative mb-5 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-600 animate-spin"></div>
          <div className="absolute w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-pulse" />
          </div>
        </div>

        <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-1.5">
          {editingProperty ? "Saving Changes..." : "Creating Property..."}
        </h3>

        <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-4 animate-pulse">
          {submitStatus || "Setting up property coordinates..."}
        </p>

        <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden mb-3">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full w-full rounded-full animate-pulse"></div>
        </div>

        <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
          Please wait while we initialize property GPS location and sync the map...
        </p>
      </div>
    </div>
  );
};

export default PropertySubmittingOverlay;
