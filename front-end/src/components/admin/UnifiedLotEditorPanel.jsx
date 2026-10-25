import React, { useState, useRef } from "react";
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
}) {
  // Ultra-smooth local floating draggable position (persisted in sessionStorage)
  const [floatingPos, setFloatingPos] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem("unifiedLotPanelPos");
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
      const width = 340;
      const initialX = Math.max(16, Math.floor(window.innerWidth / 2 - width / 2));
      return { x: initialX, y: 100 };
    }
    return { x: 380, y: 100 };
  });

  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const handleMouseDownHeader = (e) => {
    if (e.target.closest("button") || e.target.closest("input") || e.target.closest("select")) return;
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
        const panelWidth = 340;
        const newX = Math.max(10, Math.min(window.innerWidth - panelWidth - 10, moveEvent.clientX - dragOffsetRef.current.x));
        const newY = Math.max(10, Math.min(window.innerHeight - 320, moveEvent.clientY - dragOffsetRef.current.y));
        setFloatingPos({ x: newX, y: newY });
      });
    };

    const handleMouseUp = (upEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      if (rafId) cancelAnimationFrame(rafId);
      const panelWidth = 340;
      const finalX = Math.max(10, Math.min(window.innerWidth - panelWidth - 10, upEvent.clientX - dragOffsetRef.current.x));
      const finalY = Math.max(10, Math.min(window.innerHeight - 320, upEvent.clientY - dragOffsetRef.current.y));
      try {
        sessionStorage.setItem("unifiedLotPanelPos", JSON.stringify({ x: finalX, y: finalY }));
      } catch (_) {}
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleTouchStartHeader = (e) => {
    if (e.target.closest("button") || e.target.closest("input") || e.target.closest("select")) return;
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
        const panelWidth = 340;
        const newX = Math.max(10, Math.min(window.innerWidth - panelWidth - 10, t.clientX - dragOffsetRef.current.x));
        const newY = Math.max(10, Math.min(window.innerHeight - 320, t.clientY - dragOffsetRef.current.y));
        setFloatingPos({ x: newX, y: newY });
      });
    };

    const handleTouchEnd = () => {
      isDraggingRef.current = false;
      if (rafId) cancelAnimationFrame(rafId);
      try {
        sessionStorage.setItem("unifiedLotPanelPos", JSON.stringify(floatingPos));
      } catch (_) {}
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };

    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
  };

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
        onMouseDown={handleMouseDownHeader}
        onTouchStart={handleTouchStartHeader}
        className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 cursor-move active:cursor-grabbing select-none"
        title="Hold and drag to move panel anywhere"
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-slate-500 hover:text-slate-300 transition" />
          <span className={`w-2 h-2 rounded-full ${isNewLot ? "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]" : "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.9)]"}`} />
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
          <label htmlFor="unified-lot-number-input" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Lot Identifier / Number
          </label>
          <input
            id="unified-lot-number-input"
            name="lot_number"
            type="text"
            required
            value={lotNumber}
            onChange={(e) => onLotNumberChange?.(e.target.value)}
            placeholder="e.g. Lot 1"
            className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner"
            autoFocus={isNewLot}
          />
        </div>

        {/* ── 2. Area (sqm) ─────────────────────────── */}
        <div>
          <label htmlFor="unified-lot-area-input" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Area (sqm)
          </label>
          <input
            id="unified-lot-area-input"
            name="target_area"
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
              className="py-2 px-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-slate-800 disabled:to-slate-800 text-white rounded-xl text-xs font-bold transition shadow-md shadow-cyan-600/20 active:scale-95 cursor-pointer flex items-center justify-center gap-1"
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
