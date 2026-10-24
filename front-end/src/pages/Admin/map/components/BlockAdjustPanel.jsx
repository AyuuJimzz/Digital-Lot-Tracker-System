import React from "react";
import {
  Layers,
  X,
  RotateCcw,
  RotateCw,
  Maximize2,
  Check,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";

export function BlockAdjustPanel({
  isBlockAdjusting,
  availableBlocks = [],
  selectedBlock,
  setSelectedBlock,
  selectedBlockLots = [],
  scaleX = 1.0,
  scaleY = 1.0,
  rotation = 0,
  offset = { lat: 0, lng: 0 },
  isSaving = false,
  handleScaleDelta,
  handleNudge,
  handleRotateDelta,
  handleReset,
  handleSaveBlock,
  handleClose,
}) {
  if (!isBlockAdjusting) return null;

  const pctX = Math.round(scaleX * 100);
  const pctY = Math.round(scaleY * 100);
  const isChanged =
    scaleX !== 1.0 ||
    scaleY !== 1.0 ||
    rotation !== 0 ||
    offset.lat !== 0 ||
    offset.lng !== 0;

  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-2xl border border-slate-700/80 rounded-2xl shadow-2xl p-4 w-[95vw] max-w-lg text-slate-200 z-[9999] select-none animate-in fade-in zoom-in-95 duration-150"
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse" />
          <div className="flex items-center gap-1.5 font-bold text-white text-sm">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Adjust & Expand Block</span>
          </div>
          {selectedBlock && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-500/40 text-[11px] font-bold text-indigo-300">
              {selectedBlockLots.length} Lots
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition cursor-pointer"
          title="Close Block Adjust Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3 text-xs">
        {/* ── 1. Block Selector & Live Dimensions ──────────────── */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Active Block
            </label>
            <select
              value={selectedBlock || ""}
              onChange={(e) => setSelectedBlock(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-800/90 border border-slate-700 rounded-xl font-bold text-white text-xs focus:outline-none focus:border-indigo-500 cursor-pointer shadow-inner"
            >
              {availableBlocks.map((blk) => (
                <option key={blk} value={blk}>
                  {blk}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 pt-4">
            <div className="px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700 font-mono text-[11px] font-bold text-slate-200">
              <span className="text-slate-500 mr-1">Width:</span>
              <span className={pctX !== 100 ? "text-indigo-400" : "text-white"}>{pctX}%</span>
            </div>
            <div className="px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700 font-mono text-[11px] font-bold text-slate-200">
              <span className="text-slate-500 mr-1">Length:</span>
              <span className={pctY !== 100 ? "text-indigo-400" : "text-white"}>{pctY}%</span>
            </div>
          </div>
        </div>

        {/* ── 2. Direct Side Control Visual Banner ──────────────── */}
        <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-2.5 flex items-start gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-600/30 text-indigo-300 shrink-0 mt-0.5">
            <Maximize2 className="w-4 h-4" />
          </div>
          <div className="text-[11px] leading-relaxed">
            <span className="font-bold text-white block">Direct Map Side Handles</span>
            <span className="text-slate-300">
              I-drag ang <strong className="text-indigo-400">asul na handles</strong> sa mismong gilid ng kahon sa mapa para i-stretch ang lapad (width) o haba (length) ng block.
            </span>
          </div>
        </div>

        {/* ── 3. Quick Scale & Nudge Steppers ─────────────────── */}
        <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Quick Increment Buttons */}
          <div className="flex items-center gap-1 w-full sm:w-auto">
            <span className="text-[10px] font-semibold text-slate-400 mr-1 uppercase">Quick Scale:</span>
            <button
              type="button"
              onClick={() => handleScaleDelta(-0.02)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-semibold rounded-lg text-[11px] transition cursor-pointer"
              title="Shrink by 2%"
            >
              -2%
            </button>
            <button
              type="button"
              onClick={() => handleScaleDelta(0.02)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-emerald-400 font-semibold rounded-lg text-[11px] transition cursor-pointer"
              title="Expand by 2%"
            >
              +2%
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            {/* Rotation */}
            <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => handleRotateDelta(-0.5)}
                className="p-1 hover:bg-slate-700 text-slate-300 rounded transition cursor-pointer"
                title="Rotate -0.5° Counter-Clockwise"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono font-bold px-1 text-slate-300">
                {rotation}°
              </span>
              <button
                type="button"
                onClick={() => handleRotateDelta(0.5)}
                className="p-1 hover:bg-slate-700 text-slate-300 rounded transition cursor-pointer"
                title="Rotate +0.5° Clockwise"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Nudge */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleNudge("up")}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition active:scale-95 cursor-pointer flex items-center justify-center"
                title="Slide Forward along Block / Road"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleNudge("down")}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition active:scale-95 cursor-pointer flex items-center justify-center"
                title="Slide Backward along Block / Road"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleNudge("left")}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition active:scale-95 cursor-pointer flex items-center justify-center"
                title="Slide Left across Road"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleNudge("right")}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition active:scale-95 cursor-pointer flex items-center justify-center"
                title="Slide Right across Road"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── 4. Action Buttons ────────────────────────────────── */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={handleReset}
            disabled={!isChanged || isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className="px-3 py-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveBlock}
              disabled={isSaving || !isChanged}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition cursor-pointer"
            >
              {isSaving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save {selectedBlock || "Block"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BlockAdjustPanel;
