// front-end/src/components/admin/HelpGuideModal.jsx
import React from "react";
import { X, PlusCircle, CheckCircle2, Search, Layers, HelpCircle } from "lucide-react";

export function HelpGuideModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-lg">
              <HelpCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">System Quick Guide & Instructions</h2>
              <p className="text-xs text-blue-100">Step-by-step guide for managing properties and lots</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-gray-700 dark:text-slate-300 text-sm">
          {/* Step 1 */}
          <div className="flex gap-4 items-start p-4 rounded-xl bg-blue-50/60 dark:bg-slate-800/60 border border-blue-100 dark:border-slate-700/60">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white font-bold text-sm shrink-0 mt-0.5">
              1
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <PlusCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Add / Create a Property (Subdivision)
              </h3>
              <p className="text-xs leading-relaxed text-gray-600 dark:text-slate-400">
                Go to <strong>Manage Properties</strong> in the sidebar. Click <strong>Add Property</strong>, enter the Subdivision Name and Address (e.g. <em>"Brgy. Oton, Iloilo"</em>). The system automatically detects its GPS location.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4 items-start p-4 rounded-xl bg-purple-50/60 dark:bg-slate-800/60 border border-purple-100 dark:border-slate-700/60">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-purple-600 text-white font-bold text-sm shrink-0 mt-0.5">
              2
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Search className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                Find Location on the Map
              </h3>
              <p className="text-xs leading-relaxed text-gray-600 dark:text-slate-400">
                Open <strong>Map View</strong>. You can choose your property from the <strong>Properties Dropdown</strong>, or use the <strong>Location Search Bar</strong> to search any barangay/municipality (e.g. <em>"Guimbal"</em>, <em>"Pavia"</em>) and the map will fly directly there!
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4 items-start p-4 rounded-xl bg-emerald-50/60 dark:bg-slate-800/60 border border-emerald-100 dark:border-slate-700/60">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-600 text-white font-bold text-sm shrink-0 mt-0.5">
              3
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Plot & Draw Lots (Add New Lot / Overlay)
              </h3>
              <p className="text-xs leading-relaxed text-gray-600 dark:text-slate-400">
                Click <strong>Add New Lot</strong> or <strong>Site Plan Overlay</strong> on the map header to upload your subdivision blueprint or click corner points directly on the ground to create polygon lots with area sizes.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4 items-start p-4 rounded-xl bg-amber-50/60 dark:bg-slate-800/60 border border-amber-100 dark:border-slate-700/60">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-amber-600 text-white font-bold text-sm shrink-0 mt-0.5">
              4
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Manage Sales & Customer Reservations
              </h3>
              <p className="text-xs leading-relaxed text-gray-600 dark:text-slate-400">
                Click any lot on the interactive map to open its side drawer. Update its status to <strong>Available</strong>, <strong>Pending (Reservation)</strong>, or <strong>Sold</strong> with customer details.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 bg-gray-50 dark:bg-slate-800/70 border-t border-gray-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors shadow-sm"
          >
            Got it, close guide
          </button>
        </div>
      </div>
    </div>
  );
}
