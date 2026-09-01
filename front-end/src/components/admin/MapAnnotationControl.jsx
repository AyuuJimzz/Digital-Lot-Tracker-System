import React from "react";
import { Type, Plus, Trash2, Check, X, Lock, Unlock, Move } from "lucide-react";

export function MapAnnotationControl({
  annotations = [],
  activeAnnotationId,
  onSelectAnnotation,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onSaveAnnotations,
  isSaving = false,
  isEditing = true,
  onToggleEditing,
  onClose,
}) {
  const activeItem = annotations.find((a) => a.id === activeAnnotationId) || annotations[0];

  const fontSizes = [
    { value: 4,  label: "4px",  tag: "Micro" },
    { value: 6,  label: "6px",  tag: "Tiny" },
    { value: 8,  label: "8px",  tag: "XS" },
    { value: 10, label: "10px", tag: "Small" },
    { value: 12, label: "12px", tag: "Base" },
    { value: 14, label: "14px", tag: "Med" },
    { value: 16, label: "16px", tag: "Lg" },
    { value: 20, label: "20px", tag: "XL" },
    { value: 26, label: "26px", tag: "Title" },
  ];

  const colors = [
    { key: "#ffffff", ring: "ring-white/60" },
    { key: "#fbbf24", ring: "ring-amber-400/60" },
    { key: "#00f0ff", ring: "ring-cyan-400/60" },
    { key: "#34d399", ring: "ring-emerald-400/60" },
    { key: "#f87171", ring: "ring-red-400/60" },
    { key: "#0f172a", ring: "ring-slate-400/60" },
  ];

  const angleSteps = [
    { label: "−5", val: -5 },
    { label: "−1", val: -1 },
    { label: "0", val: 0, absolute: true },
    { label: "+1", val: 1 },
    { label: "+5", val: 5 },
    { label: "+90", val: 90, absolute: true },
  ];

  return (
    <div
      className="absolute top-3 right-14 z-[1000] text-slate-200 select-none"
      style={{ width: 280, maxHeight: "calc(100vh - 5rem)" }}
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(145deg, rgba(15,23,42,0.97), rgba(30,41,59,0.95))",
          border: "1px solid rgba(100,116,139,0.25)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* ── Header ─────────────────────────────── */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid rgba(100,116,139,0.18)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                boxShadow: "0 2px 8px rgba(59,130,246,0.35)",
              }}
            >
              <Type className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h3 className="text-[13px] font-bold text-white leading-none tracking-tight">
                Road Labels
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-none">
                Text annotations on map
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 rounded-md transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── Actions Row ────────────────────────── */}
        <div className="px-4 py-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={onAddAnnotation}
            className="flex-1 flex items-center justify-center gap-1.5 py-[7px] text-white rounded-lg text-[11px] font-semibold transition-all active:scale-[0.97] cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #3b82f6, #6366f1)",
              boxShadow: "0 2px 10px rgba(59,130,246,0.3)",
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Label</span>
          </button>

          <button
            type="button"
            onClick={onToggleEditing}
            className="flex items-center gap-1 px-3 py-[7px] rounded-lg text-[11px] font-semibold border transition-all cursor-pointer"
            style={{
              background: isEditing ? "rgba(245,158,11,0.12)" : "rgba(51,65,85,0.5)",
              borderColor: isEditing ? "rgba(245,158,11,0.35)" : "rgba(100,116,139,0.3)",
              color: isEditing ? "#fbbf24" : "#94a3b8",
            }}
          >
            {isEditing ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            <span>{isEditing ? "Edit" : "Lock"}</span>
          </button>
        </div>

        <div
          className="mx-4"
          style={{ height: 1, background: "rgba(100,116,139,0.15)" }}
        />

        {/* ── Content ────────────────────────────── */}
        <div
          className="px-4 py-3"
          style={{ maxHeight: "calc(100vh - 16rem)", overflowY: "auto" }}
        >
          {annotations.length > 0 ? (
            <div className="space-y-3">
              {/* Label Selector */}
              <div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Labels ({annotations.length})
                </span>
                <div className="mt-1.5 max-h-24 overflow-y-auto space-y-1 pr-0.5">
                  {annotations.map((item, idx) => {
                    const isActive = activeItem?.id === item.id;
                    return (
                      <div
                        key={item.id || idx}
                        onClick={() => onSelectAnnotation(item.id)}
                        className="flex items-center justify-between px-2.5 py-[6px] rounded-lg text-[11px] cursor-pointer transition-all"
                        style={{
                          background: isActive
                            ? "rgba(59,130,246,0.15)"
                            : "rgba(30,41,59,0.5)",
                          border: `1px solid ${isActive ? "rgba(59,130,246,0.4)" : "rgba(100,116,139,0.15)"}`,
                          color: isActive ? "#93c5fd" : "#cbd5e1",
                        }}
                      >
                        <span className="truncate flex-1 font-medium text-[11px]">
                          {item.text || `Label ${idx + 1}`}
                        </span>
                        <span className="text-[9px] font-mono ml-2 opacity-50">
                          {Math.round(item.rotation || 0)}°
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Editor ───────────────────────── */}
              {activeItem && (
                <div
                  className="rounded-xl p-3 space-y-3"
                  style={{
                    background: "rgba(15,23,42,0.6)",
                    border: "1px solid rgba(100,116,139,0.18)",
                  }}
                >
                  {/* Text */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Text
                    </label>
                    <input
                      type="text"
                      value={activeItem.text}
                      onChange={(e) =>
                        onUpdateAnnotation(activeItem.id, { text: e.target.value })
                      }
                      placeholder="e.g. ROAD LOT 3 (6.50 M.)"
                      className="mt-1 w-full px-2.5 py-[6px] rounded-lg text-[12px] font-bold text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/60"
                      style={{
                        background: "rgba(15,23,42,0.8)",
                        border: "1px solid rgba(100,116,139,0.25)",
                      }}
                    />
                  </div>

                  {/* Angle */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
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
                            onUpdateAnnotation(activeItem.id, {
                              rotation: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-12 px-1 py-[2px] text-center text-[11px] font-mono font-bold text-white rounded focus:outline-none"
                          style={{
                            background: "rgba(15,23,42,0.8)",
                            border: "1px solid rgba(100,116,139,0.25)",
                          }}
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
                        onUpdateAnnotation(activeItem.id, {
                          rotation: parseFloat(e.target.value),
                        })
                      }
                      className="w-full h-[3px] rounded-full appearance-none cursor-pointer accent-blue-500"
                      style={{ background: "rgba(100,116,139,0.3)" }}
                    />

                    {/* Nudge buttons */}
                    <div className="grid grid-cols-6 gap-[3px] mt-1.5">
                      {angleSteps.map((btn, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            let next = btn.absolute
                              ? btn.val
                              : (activeItem.rotation || 0) + btn.val;
                            if (next > 180) next -= 360;
                            if (next < -180) next += 360;
                            onUpdateAnnotation(activeItem.id, { rotation: next });
                          }}
                          className="py-[3px] text-[9px] font-bold text-slate-400 hover:text-white rounded transition-all active:scale-90 cursor-pointer text-center"
                          style={{
                            background: "rgba(30,41,59,0.6)",
                            border: "1px solid rgba(100,116,139,0.15)",
                          }}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Size & Color Row */}
                  <div className="flex items-start gap-3">
                    {/* Font Size Compact */}
                    <div className="flex-1">
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        Size
                      </label>
                      <select
                        value={activeItem.fontSize || 12}
                        onChange={(e) =>
                          onUpdateAnnotation(activeItem.id, {
                            fontSize: parseInt(e.target.value),
                          })
                        }
                        className="mt-1 w-full px-2 py-[5px] rounded-lg text-[11px] font-bold text-white focus:outline-none cursor-pointer"
                        style={{
                          background: "rgba(15,23,42,0.8)",
                          border: "1px solid rgba(100,116,139,0.25)",
                        }}
                      >
                        {fontSizes.map((fs) => (
                          <option key={fs.value} value={fs.value}>
                            {fs.label} — {fs.tag}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Colors */}
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        Color
                      </label>
                      <div className="mt-1.5 flex items-center gap-[5px]">
                        {colors.map((c) => {
                          const isActive =
                            (activeItem.color || "#ffffff").toLowerCase() ===
                            c.key.toLowerCase();
                          return (
                            <button
                              key={c.key}
                              type="button"
                              onClick={() =>
                                onUpdateAnnotation(activeItem.id, { color: c.key })
                              }
                              className={`w-[18px] h-[18px] rounded-full transition-all cursor-pointer ${
                                isActive
                                  ? `ring-[2px] ${c.ring} scale-110`
                                  : "opacity-70 hover:opacity-100 hover:scale-105"
                              }`}
                              style={{
                                backgroundColor: c.key,
                                border:
                                  c.key === "#0f172a"
                                    ? "1px solid rgba(100,116,139,0.5)"
                                    : "none",
                                boxShadow: isActive
                                  ? `0 0 8px ${c.key}44`
                                  : "none",
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Footer: Drag hint + Delete */}
                  <div
                    className="flex items-center justify-between pt-2"
                    style={{ borderTop: "1px solid rgba(100,116,139,0.12)" }}
                  >
                    <span className="flex items-center gap-1 text-[9px] text-slate-500">
                      <Move className="w-2.5 h-2.5" />
                      Drag to reposition
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteAnnotation(activeItem.id)}
                      className="flex items-center gap-1 text-[10px] text-red-400/80 hover:text-red-300 hover:bg-red-500/10 px-2 py-[3px] rounded-md transition-all cursor-pointer"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── Save ─────────────────────────── */}
              <button
                type="button"
                disabled={isSaving}
                onClick={onSaveAnnotations}
                className="w-full flex items-center justify-center gap-1.5 py-[9px] text-white rounded-xl text-[11px] font-semibold transition-all active:scale-[0.97] cursor-pointer disabled:opacity-40"
                style={{
                  background: isSaving
                    ? "rgba(51,65,85,0.5)"
                    : "linear-gradient(135deg, #059669, #0d9488)",
                  boxShadow: isSaving
                    ? "none"
                    : "0 2px 10px rgba(5,150,105,0.3)",
                }}
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSaving ? "Saving..." : "Save Labels"}</span>
              </button>
            </div>
          ) : (
            <div className="py-6 text-center">
              <div
                className="w-10 h-10 mx-auto mb-2.5 rounded-xl flex items-center justify-center"
                style={{
                  background: "rgba(59,130,246,0.1)",
                  border: "1px solid rgba(59,130,246,0.2)",
                }}
              >
                <Type className="w-5 h-5 text-blue-400/60" />
              </div>
              <p className="text-[11px] text-slate-400 mb-0.5">No labels yet</p>
              <p className="text-[10px] text-slate-500">
                Add a label to annotate roads or open areas
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
