import React from "react";
import ReactDOM from "react-dom";
import {
  GripHorizontal,
  X,
  Plus,
  Check,
  Magnet,
} from "lucide-react";

export function UnifiedLotEditorPanel({
  isOpen,
  isNewLot = true,
  lotNumber = "",
  onLotNumberChange,
  targetArea = 100,
  onTargetAreaChange,
  liveArea = 0,
  status = "Available",
  onStatusChange,
  enableSnapping = true,
  onToggleSnapping,
  onSave,
  onSaveAndNext,
  onCancel,
  isSaving = false,
  floatingPos = { x: 380, y: 110 },
  onMouseDownHeader,
}) {
  if (!isOpen || typeof document === "undefined") return null;

  return ReactDOM.createPortal(
    <div
      style={{
        position: "fixed",
        left: `${floatingPos.x}px`,
        top: `${floatingPos.y}px`,
        zIndex: 99999,
      }}
      className="bg-slate-900/95 backdrop-blur-2xl border border-slate-700/80 rounded-2xl shadow-2xl p-4 w-84 text-slate-200 select-none cursor-default animate-in fade-in zoom-in-95 duration-150"
    >
      {/* ── Header ──────────────────────────────────── */}
      <div
        onMouseDown={onMouseDownHeader}
        className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 cursor-move active:cursor-grabbing select-none"
        title="Hold and drag to move"
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-slate-500" />
          <span className={`w-2 h-2 rounded-full ${isNewLot ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-blue-400"}`} />
          <span className="font-bold text-white text-sm tracking-wide">
            {isNewLot ? "Quick Add Lot" : `Edit ${lotNumber || "Lot"}`}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Subtle Magnet Snap Toggle */}
          <button
            type="button"
            onClick={onToggleSnapping}
            className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1 text-[11px] font-semibold ${
              enableSnapping
                ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/40"
                : "bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200"
            }`}
            title={`Snap to corners: ${enableSnapping ? "ON" : "OFF"}`}
          >
            <Magnet className={`w-3.5 h-3.5 ${enableSnapping ? "text-indigo-400" : "text-slate-400"}`} />
            <span>Snap</span>
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Cancel / Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {/* ── 1. Lot Identifier / Number ────────────── */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Lot Identifier / Number
          </label>
          <input
            type="text"
            required
            value={lotNumber}
            onChange={(e) => onLotNumberChange?.(e.target.value)}
            placeholder="e.g. Lot 1"
            className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner"
            autoFocus={isNewLot}
          />
        </div>

        {/* ── 2. Area (sqm) + Presets + Live Badge ───── */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Area (sqm)
              </label>
              {liveArea > 0 && (
                <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                  {liveArea.toFixed(1)} sqm live
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {[100, 120, 150].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => onTargetAreaChange?.(sz)}
                  className={`text-[10px] px-1.5 py-0.5 rounded border transition cursor-pointer font-semibold ${
                    Number(targetArea) === sz
                      ? "bg-blue-600 text-white border-blue-500 shadow-sm font-bold"
                      : "bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200 hover:bg-slate-700"
                  }`}
                >
                  {sz} sqm
                </button>
              ))}
            </div>
          </div>
          <input
            type="number"
            min="1"
            step="any"
            required
            value={targetArea}
            onChange={(e) => onTargetAreaChange?.(parseFloat(e.target.value) || 0)}
            placeholder="100"
            className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner"
          />
        </div>

        {/* ── 3. Status Selector ────────────────────── */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Status
          </label>
          <div className="grid grid-cols-3 gap-1.5 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
            {[
              { key: "Available", label: "Available", activeClass: "bg-emerald-600 text-white border-emerald-500 shadow-sm" },
              { key: "Pending",   label: "Pending",   activeClass: "bg-amber-600 text-white border-amber-500 shadow-sm" },
              { key: "Sold",      label: "Sold",      activeClass: "bg-rose-600 text-white border-rose-500 shadow-sm" },
            ].map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => onStatusChange?.(st.key)}
                className={`py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer text-center ${
                  status === st.key
                    ? st.activeClass
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── 4. Action Buttons ─────────────────────── */}
        <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            className="px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl text-xs font-semibold transition cursor-pointer text-center"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isSaving || !lotNumber.trim()}
            onClick={onSave}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isSaving ? "Saving..." : "Save Lot"}</span>
          </button>

          {isNewLot && (
            <button
              type="button"
              disabled={isSaving || !lotNumber.trim()}
              onClick={onSaveAndNext}
              className="py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-800 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer flex items-center justify-center gap-1"
              title="Save this lot and immediately start tracing the next adjacent lot"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Next</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
