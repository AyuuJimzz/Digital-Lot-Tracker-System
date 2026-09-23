import React from "react";
import { Check, Loader2, Maximize2, Minimize2, Minus, Pencil, Plus, RotateCcw } from "lucide-react";

export default function PlanToolbar({
  zoom,
  setZoom,
  resetView,
  disabled,
  onRescan,
  isRescanning,
  onAddManualCandidate,
  activeCandidate,
  onToggleEditShape,
  isEditingShape,
  onResetBoundary,
  canResetBoundary,
  onToggleExpand,
  isExpanded,
}) {
  return (
    <>
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-400">Source Plan</span>
          <span className="text-[10px] font-mono text-slate-500">{Math.round(zoom * 100)}%</span>
        </div>
        <div className="flex items-center gap-1">
          {onRescan && (
            <button
              type="button"
              disabled={disabled || isRescanning}
              onClick={onRescan}
              className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
              title="Deep re-scan blueprint with higher dashed-line tolerance"
            >
              {isRescanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              <span>{isRescanning ? "Scanning…" : "Deep Rescan"}</span>
            </button>
          )}

          {onAddManualCandidate && (
            <button
              type="button"
              disabled={disabled}
              onClick={onAddManualCandidate}
              className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              title="Add a new manual lot boundary directly on the blueprint"
            >
              <Plus className="h-3 w-3" />
              <span>Add lot</span>
            </button>
          )}

          {activeCandidate && onToggleEditShape && (
            <div className={`flex items-center gap-1 rounded-md transition ${
              isEditingShape ? "bg-emerald-500/10 p-0.5 border border-emerald-500/20" : ""
            }`}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onToggleEditShape(!isEditingShape)}
                className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium transition ${
                  isEditingShape
                    ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
                title={isEditingShape ? "Finish editing and lock lot shape" : "Edit corner points and move this lot"}
              >
                {isEditingShape ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span>Done</span>
                  </>
                ) : (
                  <>
                    <Pencil className="h-3 w-3" />
                    <span>Edit shape</span>
                  </>
                )}
              </button>

              {isEditingShape && onResetBoundary && (
                <button
                  type="button"
                  disabled={disabled || !canResetBoundary}
                  onClick={onResetBoundary}
                  aria-label="Reset active boundary"
                  className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-slate-300 hover:bg-white/10 hover:text-white transition disabled:cursor-not-allowed disabled:opacity-30"
                  title="Reset active boundary back to its detected shape"
                >
                  <RotateCcw className="h-3 w-3 text-slate-400" />
                  <span>Reset boundary</span>
                </button>
              )}
            </div>
          )}

          <div className="h-3.5 w-px bg-white/10 mx-0.5" />

          {/* Zoom Controls */}
          <button
            type="button"
            aria-label="Zoom out of plan"
            disabled={disabled || zoom <= 1}
            onClick={() => setZoom((value) => Math.max(1, value / 1.5))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-white/5 hover:text-slate-300 disabled:opacity-30 transition"
          >
            <Minus className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="Zoom into plan"
            disabled={disabled || zoom >= 24}
            onClick={() => setZoom((value) => Math.min(24, value * 1.5))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-white/5 hover:text-slate-300 disabled:opacity-30 transition"
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={resetView}
            className="h-7 rounded-md px-2 text-[11px] font-medium text-slate-500 hover:bg-white/5 hover:text-slate-300 disabled:opacity-30 transition"
          >
            Fit
          </button>

          {onToggleExpand && (
            <>
              <div className="h-3.5 w-px bg-white/10 mx-0.5" />
              <button
                type="button"
                disabled={disabled}
                onClick={onToggleExpand}
                className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium text-slate-500 hover:bg-white/5 hover:text-slate-300 disabled:opacity-30 transition"
                title={isExpanded ? "Restore side-by-side view" : "Expand map to full width"}
              >
                {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                <span>{isExpanded ? "Split" : "Expand"}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Legend bar */}
      <div className="flex items-center gap-4 border-b border-white/[0.04] px-4 py-1.5 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Saleable
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-500" />
          Non-Saleable
        </span>
        {isEditingShape ? (
          <span className="text-emerald-400/70 ml-1">
            Edit mode — drag corners · double-click to delete · click + to add
          </span>
        ) : (
          <span className="text-slate-600 ml-1">Click Edit shape to adjust · drag to pan</span>
        )}
      </div>
    </>
  );
}
