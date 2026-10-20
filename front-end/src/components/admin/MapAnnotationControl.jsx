import React, { useState } from "react";
import { Plus, Trash2, Check, X, Lock, Unlock, Move, Copy } from "lucide-react";

export function MapAnnotationControl({
  annotations = [],
  activeAnnotationId,
  selectedAnnotationIds = [],
  onSelectAnnotation,
  onToggleSelectAnnotation,
  onSelectAllAnnotations,
  onDeselectAllAnnotations,
  onAddAnnotation,
  onGenerateBlockLabels,
  onUpdateAnnotation,
  onUpdateSelectedAnnotations,
  onUpdateAllAnnotations,
  onDeleteAnnotation,
  onDeleteSelectedAnnotations,
  onDeleteAllAnnotations,
  onSaveAnnotations,
  isSaving = false,
  isEditing = true,
  onToggleEditing,
  onClose,
}) {
  const [appliedSuccess, setAppliedSuccess] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const activeAnnotations = annotations.filter((a) => !a.deleted);

  // Normalize selected IDs
  const currentSelectedIds =
    selectedAnnotationIds && selectedAnnotationIds.length > 0
      ? selectedAnnotationIds
      : activeAnnotationId
      ? [activeAnnotationId]
      : [];

  const selectedCount = currentSelectedIds.length;
  const isMulti = selectedCount > 1;
  const isAllSelected =
    activeAnnotations.length > 0 &&
    activeAnnotations.every((a) => currentSelectedIds.includes(a.id));
  const isSomeSelected =
    currentSelectedIds.length > 0 && !isAllSelected;

  const activeItem =
    annotations.find(
      (a) =>
        a.id === activeAnnotationId ||
        (currentSelectedIds.length > 0 && a.id === currentSelectedIds[0])
    ) || activeAnnotations[0];

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

  const handleAngleChange = (rotationVal, isAbsolute = false) => {
    if (isMulti) {
      if (onUpdateSelectedAnnotations) {
        if (isAbsolute) {
          onUpdateSelectedAnnotations({ rotation: rotationVal });
        } else {
          onUpdateSelectedAnnotations((a) => {
            let next = (a.rotation || 0) + rotationVal;
            if (next > 180) next -= 360;
            if (next < -180) next += 360;
            return { rotation: next };
          });
        }
      }
    } else {
      if (!activeItem || !onUpdateAnnotation) return;
      let next = isAbsolute ? rotationVal : (activeItem.rotation || 0) + rotationVal;
      if (next > 180) next -= 360;
      if (next < -180) next += 360;
      onUpdateAnnotation(activeItem.id, { rotation: next });
    }
  };

  const handleFontSizeChange = (fontSize) => {
    if (isMulti && onUpdateSelectedAnnotations) {
      onUpdateSelectedAnnotations({ fontSize });
    } else if (activeItem && onUpdateAnnotation) {
      onUpdateAnnotation(activeItem.id, { fontSize });
    }
  };

  const handleColorChange = (color) => {
    if (isMulti && onUpdateSelectedAnnotations) {
      onUpdateSelectedAnnotations({ color });
    } else if (activeItem && onUpdateAnnotation) {
      onUpdateAnnotation(activeItem.id, { color });
    }
  };

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      if (onDeselectAllAnnotations) onDeselectAllAnnotations();
    } else {
      if (onSelectAllAnnotations) onSelectAllAnnotations();
    }
  };

  const handleDeleteActiveOrSelected = () => {
    if (isMulti && onDeleteSelectedAnnotations) {
      onDeleteSelectedAnnotations();
    } else if (activeItem && onDeleteAnnotation) {
      onDeleteAnnotation(activeItem.id);
    }
  };

  const handleApplyStyleToAll = () => {
    if (!activeItem || !onUpdateAllAnnotations) return;
    onUpdateAllAnnotations({
      fontSize: activeItem.fontSize || 14,
      color: activeItem.color || "#ffffff",
    });
    setAppliedSuccess(true);
    setTimeout(() => setAppliedSuccess(false), 2500);
  };

  return (
    <div className="absolute top-3 right-14 z-[1000] w-80 select-none">
      <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden text-slate-200">
        
        {/* ── Header ─────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${isEditing ? "bg-emerald-400 animate-pulse" : "bg-cyan-400"}`}
            />
            <div>
              <h3 className="text-xs font-bold text-white tracking-wide">Road & Map Labels</h3>
              <p className="text-[10px] text-slate-400">
                {isEditing ? "Click or drag labels on map" : "Positions locked on map"}
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

        {/* ── Auto-Generate Block Labels Action ── */}
        {onGenerateBlockLabels && (
          <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/40">
            <button
              type="button"
              onClick={onGenerateBlockLabels}
              className="w-full h-8 flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 hover:text-amber-200 rounded-lg text-xs font-semibold transition active:scale-95 cursor-pointer border border-amber-500/40 shadow-sm"
              title="Auto-detect all blocks from lots and create draggable block labels on the map"
            >
              <span>⚡ Auto-Add Block Labels</span>
            </button>
          </div>
        )}

        {/* ── Content ────────────────────────────── */}
        <div
          className="px-4 py-3 space-y-3"
          style={{ maxHeight: "calc(100vh - 16rem)", overflowY: "auto" }}
        >
          {activeAnnotations.length > 0 ? (
            <>
              {/* ── Labels List Section ───────────── */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Labels ({activeAnnotations.length})
                    </span>
                    {selectedCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                        {selectedCount} selected
                      </span>
                    )}
                  </div>

                  {/* Clean Clear All action */}
                  {activeAnnotations.length > 1 && (
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

                {/* Select All Toggle Bar */}
                <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-800 rounded-lg mb-1.5 border border-slate-700/60 transition">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none flex-1">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeSelected;
                      }}
                      onChange={handleToggleSelectAll}
                      className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-900 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                    <span className="font-semibold text-[11px] text-slate-200">
                      {isAllSelected ? "Deselect All" : "Select All"}
                    </span>
                  </label>
                  {isMulti && (
                    <button
                      type="button"
                      onClick={handleDeleteActiveOrSelected}
                      className="text-[10px] text-red-400 hover:text-red-300 font-medium flex items-center gap-1 cursor-pointer"
                      title="Delete all selected labels"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete ({selectedCount})</span>
                    </button>
                  )}
                </div>

                {/* List of items */}
                <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
                  {activeAnnotations.map((item, idx) => {
                    const isChecked = currentSelectedIds.includes(item.id);
                    return (
                      <div
                        key={item.id || idx}
                        onClick={() => {
                          if (onSelectAnnotation) onSelectAnnotation(item.id);
                        }}
                        className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer border transition ${
                          isChecked
                            ? "bg-blue-600/20 border-blue-500/60 text-white font-medium shadow-sm"
                            : "bg-slate-800/40 border-slate-800/80 text-slate-300 hover:bg-slate-800/70"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate flex-1">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (onToggleSelectAnnotation) {
                                onToggleSelectAnnotation(item.id);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-900 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                          />
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: item.color || "#e2e8f0" }}
                          />
                          <span className="truncate text-[11px]">
                            {item.text || `Label ${idx + 1}`}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono opacity-50 ml-2 shrink-0">
                          {Math.round(item.rotation || 0)}°
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Active / Multi Label Editor Card ───────────── */}
              {(activeItem || isMulti) && (
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/80 p-3 space-y-3">
                  
                  {/* Multi-Select Header vs Single Header */}
                  {isMulti ? (
                    <div className="flex items-center justify-between pb-1 border-b border-slate-700/60">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                        <span className="text-xs font-bold text-white">
                          Editing {selectedCount} Selected Labels
                        </span>
                      </div>
                      <span className="text-[10px] text-blue-300 font-medium">Batch Mode</span>
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="map-annotation-label-text" className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Label Text
                      </label>
                      <input
                        id="map-annotation-label-text"
                        name="annotation_label_text"
                        type="text"
                        value={activeItem?.text || ""}
                        onChange={(e) => {
                          if (activeItem && onUpdateAnnotation) {
                            onUpdateAnnotation(activeItem.id, { text: e.target.value });
                          }
                        }}
                        placeholder="e.g. BLOCK 1 or ROAD LOT 3"
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 border border-slate-700/80 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Angle / Rotation Controls */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Angle {isMulti ? "(Rotate Selected)" : ""}
                      </span>
                      {!isMulti && activeItem && (
                        <div className="flex items-center gap-1">
                          <input
                            id="map-annotation-angle-number"
                            name="annotation_angle_number"
                            aria-label="Annotation angle degrees"
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
                      )}
                    </div>

                    {!isMulti && activeItem && (
                      <input
                        id="map-annotation-angle-range"
                        name="annotation_angle_range"
                        aria-label="Annotation angle slider"
                        type="range"
                        min="-180"
                        max="180"
                        step="1"
                        value={activeItem.rotation || 0}
                        onChange={(e) =>
                          handleAngleChange(parseFloat(e.target.value) || 0, true)
                        }
                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 mb-2"
                      />
                    )}

                    {/* Quick Nudge Buttons */}
                    <div className="grid grid-cols-6 gap-1">
                      {angleSteps.map((btn, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleAngleChange(btn.val, btn.absolute)}
                          className="py-1 text-[10px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded transition active:scale-95 cursor-pointer text-center"
                          title={btn.absolute ? `Set angle to ${btn.val}°` : `Rotate by ${btn.val}°`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Appearance (Font Size & Color) */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-700/50">
                    {/* Font Size */}
                    <div>
                      <label htmlFor="map-annotation-font-size" className="text-[10px] text-slate-400 block mb-1">
                        Font Size {isMulti ? `(${selectedCount})` : ""}
                      </label>
                      <select
                        id="map-annotation-font-size"
                        name="annotation_font_size"
                        value={activeItem?.fontSize || 14}
                        onChange={(e) =>
                          handleFontSizeChange(parseFloat(e.target.value) || 14)
                        }
                        className="w-full px-2 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 border border-slate-700/80 focus:border-blue-500 focus:outline-none cursor-pointer"
                      >
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
                        Color {isMulti ? `(${selectedCount})` : ""}
                      </span>
                      <div className="flex items-center gap-1.5 pt-0.5">
                        {colors.map((c) => {
                          const isActive =
                            (activeItem?.color || "#ffffff").toLowerCase() ===
                            c.key.toLowerCase();
                          return (
                            <button
                              key={c.key}
                              type="button"
                              title={c.label}
                              onClick={() => handleColorChange(c.key)}
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

                  {/* Apply size & color to all labels button (for quick 1-click global styling) */}
                  {!isMulti && activeAnnotations.length > 1 && (
                    <button
                      type="button"
                      onClick={handleApplyStyleToAll}
                      className={`w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[11px] font-medium border transition cursor-pointer ${
                        appliedSuccess
                          ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
                          : "bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white"
                      }`}
                    >
                      {appliedSuccess ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Applied to all {activeAnnotations.length} labels</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>Apply this style to all labels</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Card Footer: Drag hint & Delete */}
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
                          Locked
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={handleDeleteActiveOrSelected}
                      className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-950/40 px-2 py-0.5 rounded transition cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{isMulti ? `Delete (${selectedCount})` : "Delete Label"}</span>
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
              <p className="text-xs text-slate-400 mb-1">No road or block labels yet</p>
              <p className="text-[11px] text-slate-500 mb-3">
                Click "+ Add Label" or "⚡ Auto-Add Block Labels" above.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MapAnnotationControl;
