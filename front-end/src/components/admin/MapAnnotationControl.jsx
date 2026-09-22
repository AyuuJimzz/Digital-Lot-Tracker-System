import React, { useState } from "react";
import { Plus, Trash2, Check, X, Lock, Unlock, Move, Copy } from "lucide-react";

export function MapAnnotationControl({
  annotations = [],
  activeAnnotationId,
  onSelectAnnotation,
  onAddAnnotation,
  onUpdateAnnotation,
  onUpdateAllAnnotations,
  onDeleteAnnotation,
  onDeleteAllAnnotations,
  onSaveAnnotations,
  isSaving = false,
  isEditing = true,
  onToggleEditing,
  onClose,
}) {
  const [appliedSuccess, setAppliedSuccess] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const activeItem = annotations.find((a) => a.id === activeAnnotationId) || annotations[0];

  const fontSizes = [
    { value: 4,  label: "4px",  tag: "Micro" },
    { value: 6,  label: "6px",  tag: "Tiny" },
    { value: 8,  label: "8px",  tag: "XS" },
    { value: 10, label: "10px", tag: "Small" },
    { value: 12, label: "12px", tag: "Base" },
    { value: 14, label: "14px", tag: "Med" },
    { value: 16, label: "16px", tag: "Lg" },
    { value: 18, label: "18px", tag: "XL" },
    { value: 22, label: "22px", tag: "2XL" },
    { value: 26, label: "26px", tag: "Title" },
  ];

  const colors = [
    { key: "#e2e8f0", label: "Platinum" },
    { key: "#ffffff", label: "White" },
    { key: "#fbbf24", label: "Gold" },
    { key: "#00f0ff", label: "Cyan" },
    { key: "#34d399", label: "Emerald" },
    { key: "#f87171", label: "Red" },
    { key: "#0f172a", label: "Dark" },
  ];

  const angleSteps = [
    { label: "−5°", val: -5 },
    { label: "−1°", val: -1 },
    { label: "0°", val: 0, absolute: true },
    { label: "+1°", val: 1 },
    { label: "+5°", val: 5 },
    { label: "+90°", val: 90, absolute: true },
  ];

  const handleApplyStyleToAll = () => {
    if (!activeItem || !onUpdateAllAnnotations) return;
    onUpdateAllAnnotations({
      fontSize: activeItem.fontSize || 12,
      color: activeItem.color || "#e2e8f0",
    });
    setAppliedSuccess(true);
    setTimeout(() => setAppliedSuccess(false), 2500);
  };

  const handleAngleChange = (rotationVal, isAbsolute = false) => {
    if (!activeItem || !onUpdateAnnotation) return;
    let next = isAbsolute ? rotationVal : (activeItem.rotation || 0) + rotationVal;
    if (next > 180) next -= 360;
    if (next < -180) next += 360;
    onUpdateAnnotation(activeItem.id, { rotation: next });
  };

  return (
    <div className="absolute top-3 right-14 z-[1000] w-72 select-none">
      <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden text-slate-200">
        
        {/* ── Header ─────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${isEditing ? "bg-emerald-400 animate-pulse" : "bg-cyan-400"}`}
            />
            <div>
              <h3 className="text-xs font-bold text-white tracking-wide">Road Labels</h3>
              <p className="text-[10px] text-slate-400">
                {isEditing ? "Draggable on map" : "Positions locked on map"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close road labels panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Actions Row ────────────────────────── */}
        <div className="px-4 py-2.5 grid grid-cols-2 gap-2 border-b border-slate-800 bg-slate-900/60">
          <button
            type="button"
            onClick={onAddAnnotation}
            className="h-8 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition active:scale-95 cursor-pointer shadow-sm border border-transparent"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Add Label</span>
          </button>

          <button
            type="button"
            onClick={onToggleEditing}
            className={`h-8 flex items-center justify-center gap-1.5 px-2 rounded-lg text-xs font-semibold border transition active:scale-95 cursor-pointer ${
              isEditing
                ? "bg-slate-800/80 border-slate-700 text-emerald-400 hover:bg-slate-750"
                : "bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
            title={isEditing ? "Labels are draggable on map. Click to lock." : "Labels are locked. Click to unlock and move."}
          >
            {isEditing ? <Unlock className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
            <span className="truncate">{isEditing ? "Lock Positions" : "Unlock to Move"}</span>
          </button>
        </div>

        {/* ── Content ────────────────────────────── */}
        <div
          className="px-4 py-3 space-y-3"
          style={{ maxHeight: "calc(100vh - 16rem)", overflowY: "auto" }}
        >
          {annotations.length > 0 ? (
            <>
              {/* ── Labels List Section ───────────── */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Labels ({annotations.length})
                  </span>

                  {/* Clean Clear All action (only when >1 labels) */}
                  {annotations.length > 1 && (
                    <div>
                      {confirmClearAll ? (
                        <div className="flex items-center gap-1 bg-red-950/40 border border-red-800/60 px-1.5 py-0.5 rounded">
                          <span className="text-[10px] text-red-300 font-medium">Delete all?</span>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmClearAll(false);
                              if (onDeleteAllAnnotations) onDeleteAllAnnotations();
                            }}
                            className="text-[10px] px-1 bg-red-600 hover:bg-red-500 text-white rounded font-bold cursor-pointer"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmClearAll(false)}
                            className="text-[10px] px-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmClearAll(true)}
                          className="text-[10px] text-slate-500 hover:text-red-400 transition cursor-pointer"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* List of items */}
                <div className="max-h-24 overflow-y-auto space-y-1 pr-0.5">
                  {annotations.map((item, idx) => {
                    const isActive = activeItem?.id === item.id;
                    return (
                      <div
                        key={item.id || idx}
                        onClick={() => onSelectAnnotation(item.id)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer border transition ${
                          isActive
                            ? "bg-blue-600/15 border-blue-500/50 text-white font-medium shadow-sm"
                            : "bg-slate-800/40 border-slate-800/80 text-slate-300 hover:bg-slate-800/70"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate flex-1">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: item.color || "#e2e8f0" }}
                          />
                          <span className="truncate text-[11px]">
                            {item.text || `Label ${idx + 1}`}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono opacity-50 ml-2">
                          {Math.round(item.rotation || 0)}°
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Active Label Editor ───────────── */}
              {activeItem && (
                <div className="rounded-xl bg-slate-800/40 border border-slate-800 p-3 space-y-3">
                  
                  {/* Label Text Input */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Label Text
                    </label>
                    <input
                      type="text"
                      value={activeItem.text || ""}
                      onChange={(e) =>
                        onUpdateAnnotation(activeItem.id, { text: e.target.value })
                      }
                      placeholder="e.g. ROAD LOT 3 (6.50 M.)"
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 border border-slate-700/80 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Angle / Rotation Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Angle
                      </span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="-180"
                          max="180"
                          step="1"
                          value={Math.round(activeItem.rotation || 0)}
                          onChange={(e) =>
                            handleAngleChange(parseFloat(e.target.value) || 0, true)
                          }
                          className="w-12 px-1 py-0.5 text-center text-xs font-mono font-bold text-white bg-slate-900 border border-slate-700/80 rounded focus:border-blue-500 focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-500">°</span>
                      </div>
                    </div>

                    <input
                      type="range"
                      min="-180"
                      max="180"
                      step="1"
                      value={activeItem.rotation || 0}
                      onChange={(e) =>
                        handleAngleChange(parseFloat(e.target.value) || 0, true)
                      }
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />

                    {/* Quick Nudge Buttons */}
                    <div className="grid grid-cols-6 gap-1 mt-1.5">
                      {angleSteps.map((btn, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleAngleChange(btn.val, btn.absolute)}
                          className="py-1 text-[10px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded transition active:scale-95 cursor-pointer text-center"
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Appearance (Size & Color) */}
                  <div className="pt-2 border-t border-slate-700/40">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                      Appearance
                    </span>

                    <div className="flex items-start gap-3">
                      {/* Font Size Select */}
                      <div className="flex-1">
                        <span className="text-[10px] text-slate-400 block mb-1">
                          Font Size
                        </span>
                        <select
                          value={activeItem.fontSize || 12}
                          onChange={(e) => {
                            const newSize = parseFloat(e.target.value) || 12;
                            onUpdateAnnotation(activeItem.id, { fontSize: newSize });
                          }}
                          className="w-full px-2 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 border border-slate-700/80 focus:border-blue-500 focus:outline-none cursor-pointer"
                        >
                          {!fontSizes.some((size) => Math.abs(size.value - (activeItem.fontSize || 12)) < 0.5) && (
                            <option value={activeItem.fontSize}>
                              {Number(activeItem.fontSize || 12).toFixed(1)}px — Current
                            </option>
                          )}
                          {fontSizes.map((fs) => (
                            <option key={fs.value} value={fs.value}>
                              {fs.label} — {fs.tag}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Color Palette */}
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-1">
                          Color
                        </span>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          {colors.map((c) => {
                            const isActive =
                              (activeItem.color || "#e2e8f0").toLowerCase() ===
                              c.key.toLowerCase();
                            return (
                              <button
                                key={c.key}
                                type="button"
                                title={c.label}
                                onClick={() =>
                                  onUpdateAnnotation(activeItem.id, { color: c.key })
                                }
                                className={`w-4 h-4 rounded-full transition cursor-pointer ${
                                  isActive
                                    ? "ring-2 ring-white scale-110"
                                    : "opacity-70 hover:opacity-100 hover:scale-105"
                                }`}
                                style={{
                                  backgroundColor: c.key,
                                  border: c.key === "#0f172a" ? "1px solid rgba(148,163,184,0.4)" : "none",
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Unambiguous, clear "Apply size & color to all labels" button */}
                    {annotations.length > 1 && (
                      <button
                        type="button"
                        onClick={handleApplyStyleToAll}
                        className={`w-full mt-2.5 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[11px] font-medium border transition cursor-pointer ${
                          appliedSuccess
                            ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
                            : "bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white"
                        }`}
                      >
                        {appliedSuccess ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Applied size & color to all {annotations.length} labels</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-400" />
                            <span>Apply size & color to all labels</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Card Footer: Drag hint & Delete label */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-700/60">
                    <span className="flex items-center gap-1 text-[10px]">
                      {isEditing ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-medium">
                          <Move className="w-3 h-3" />
                          Drag on map to position
                        </span>
                      ) : (
                        <span className="text-slate-500 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Locked (unlock to move)
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteAnnotation(activeItem.id)}
                      className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-950/40 px-2 py-0.5 rounded transition cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete Label</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── Save Action ───────────────────────── */}
              <button
                type="button"
                disabled={isSaving}
                onClick={onSaveAnnotations}
                className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? "Saving..." : "Save Labels"}</span>
              </button>
            </>
          ) : (
            <div className="py-6 text-center">
              <p className="text-xs text-slate-400 mb-1">No road labels yet</p>
              <p className="text-[11px] text-slate-500">
                Click "+ Add Label" above to add street or block names to the map.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
