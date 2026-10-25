import React, { useState, useRef } from "react";
import ReactDOM from "react-dom";
import {
  Layers,
  X,
  RotateCcw,
  RotateCw,
  Check,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  GripHorizontal,
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
  // Dynamic floating draggable position (persisted in sessionStorage)
  const [floatingPos, setFloatingPos] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem("blockAdjustPanelPos");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (
            Number.isFinite(parsed.x) &&
            Number.isFinite(parsed.y) &&
            parsed.x >= 0 &&
            parsed.x < window.innerWidth - 100 &&
            parsed.y >= 0 &&
            parsed.y < window.innerHeight - 100
          ) {
            return parsed;
          }
        }
      } catch (_) {}
      const width = 500;
      const initialX = Math.max(16, Math.floor(window.innerWidth / 2 - width / 2));
      return { x: initialX, y: 70 };
    }
    return { x: 340, y: 70 };
  });

  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const handleMouseDownHeader = (e) => {
    if (e.target.closest("button") || e.target.closest("select") || e.target.closest("input")) return;
    if (e.button !== 0) return;
    e.preventDefault();
    isDraggingRef.current = true;
    dragOffsetRef.current = {
      x: e.clientX - floatingPos.x,
      y: e.clientY - floatingPos.y,
    };

    let rafId = null;
    const handleMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const panelWidth = Math.min(500, window.innerWidth - 32);
        const newX = Math.max(10, Math.min(window.innerWidth - panelWidth - 10, moveEvent.clientX - dragOffsetRef.current.x));
        const newY = Math.max(10, Math.min(window.innerHeight - 300, moveEvent.clientY - dragOffsetRef.current.y));
        setFloatingPos({ x: newX, y: newY });
      });
    };

    const handleMouseUp = (upEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      if (rafId) cancelAnimationFrame(rafId);
      const panelWidth = Math.min(500, window.innerWidth - 32);
      const finalX = Math.max(10, Math.min(window.innerWidth - panelWidth - 10, upEvent.clientX - dragOffsetRef.current.x));
      const finalY = Math.max(10, Math.min(window.innerHeight - 300, upEvent.clientY - dragOffsetRef.current.y));
      try {
        sessionStorage.setItem("blockAdjustPanelPos", JSON.stringify({ x: finalX, y: finalY }));
      } catch (_) {}
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleTouchStartHeader = (e) => {
    if (e.target.closest("button") || e.target.closest("select") || e.target.closest("input")) return;
    const touch = e.touches[0];
    if (!touch) return;
    isDraggingRef.current = true;
    dragOffsetRef.current = {
      x: touch.clientX - floatingPos.x,
      y: touch.clientY - floatingPos.y,
    };

    let rafId = null;
    const handleTouchMove = (moveEvent) => {
      if (!isDraggingRef.current || !moveEvent.touches[0]) return;
      const t = moveEvent.touches[0];
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const panelWidth = Math.min(500, window.innerWidth - 32);
        const newX = Math.max(10, Math.min(window.innerWidth - panelWidth - 10, t.clientX - dragOffsetRef.current.x));
        const newY = Math.max(10, Math.min(window.innerHeight - 300, t.clientY - dragOffsetRef.current.y));
        setFloatingPos({ x: newX, y: newY });
      });
    };

    const handleTouchEnd = () => {
      isDraggingRef.current = false;
      if (rafId) cancelAnimationFrame(rafId);
      try {
        sessionStorage.setItem("blockAdjustPanelPos", JSON.stringify(floatingPos));
      } catch (_) {}
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };

    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
  };

  if (!isBlockAdjusting) return null;

  const pctX = Math.round(scaleX * 100);
  const pctY = Math.round(scaleY * 100);
  const isChanged =
    scaleX !== 1.0 ||
    scaleY !== 1.0 ||
    rotation !== 0 ||
    offset.lat !== 0 ||
    offset.lng !== 0;

  const content = (
    <div
      style={{
        position: "fixed",
        left: `${floatingPos.x}px`,
        top: `${floatingPos.y}px`,
        zIndex: 99999,
      }}
      className="bg-slate-900/95 backdrop-blur-2xl border border-slate-700/80 rounded-2xl shadow-2xl p-4 w-[95vw] max-w-lg text-slate-200 select-none animate-in fade-in zoom-in-95 duration-150"
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div
        onMouseDown={handleMouseDownHeader}
        onTouchStart={handleTouchStartHeader}
        className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 cursor-move active:cursor-grabbing select-none"
        title="Hold and drag to move panel anywhere"
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-slate-500 hover:text-slate-300 transition" />
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

  return typeof document !== "undefined"
    ? ReactDOM.createPortal(content, document.body)
    : content;
}

export default BlockAdjustPanel;
