import React from "react";

export const BulkShiftAlignmentPanel = ({
  isBulkShifting,
  bulkShiftOffset,
  setBulkShiftOffset,
  handleSaveBulkShift,
  setIsBulkShifting,
  setPendingBulkShift,
  setBulkShiftError,
}) => {
  if (!isBulkShifting) return null;

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl p-4 z-[9999] flex flex-col sm:flex-row items-center gap-4 transition-all duration-300 w-11/12 max-w-xl text-slate-200">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
          <span className="font-bold text-white text-sm">
            Move All Lots Together
          </span>
        </div>
        <span className="text-xs text-slate-400 block mt-1 leading-relaxed">
          Click & drag any lot directly on the map, or use the nudge buttons below to slide all lots into alignment.
        </span>

        {/* Micro Nudge Steppers */}
        <div className="flex items-center gap-1.5 mt-2.5">
          <span className="text-[11px] font-semibold text-slate-400 mr-1">Nudge:</span>
          <button
            type="button"
            onClick={() => setBulkShiftOffset((prev) => ({ ...prev, lat: prev.lat + 0.00003 }))}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer"
            title="Nudge Up (North)"
          >
            ▲ Up
          </button>
          <button
            type="button"
            onClick={() => setBulkShiftOffset((prev) => ({ ...prev, lat: prev.lat - 0.00003 }))}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer"
            title="Nudge Down (South)"
          >
            ▼ Down
          </button>
          <button
            type="button"
            onClick={() => setBulkShiftOffset((prev) => ({ ...prev, lng: prev.lng - 0.00003 }))}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer"
            title="Nudge Left (West)"
          >
            ◄ Left
          </button>
          <button
            type="button"
            onClick={() => setBulkShiftOffset((prev) => ({ ...prev, lng: prev.lng + 0.00003 }))}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer"
            title="Nudge Right (East)"
          >
            ► Right
          </button>
          {(bulkShiftOffset.lat !== 0 || bulkShiftOffset.lng !== 0) && (
            <button
              type="button"
              onClick={() => setBulkShiftOffset({ lat: 0, lng: 0 })}
              className="px-2 py-1 text-slate-400 hover:text-slate-200 text-xs underline cursor-pointer ml-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="flex sm:flex-col gap-2 w-full sm:w-auto justify-end shrink-0">
        <button
          onClick={handleSaveBulkShift}
          className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/30 active:scale-95 cursor-pointer text-center"
        >
          Save All Lots
        </button>
        <button
          onClick={() => {
            setIsBulkShifting(false);
            setBulkShiftOffset({ lat: 0, lng: 0 });
            setPendingBulkShift(false);
            setBulkShiftError("");
          }}
          className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 text-xs font-semibold rounded-xl transition-all active:scale-95 cursor-pointer text-center"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default BulkShiftAlignmentPanel;
