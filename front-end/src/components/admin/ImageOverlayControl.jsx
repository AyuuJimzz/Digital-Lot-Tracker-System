import { useRef } from "react";
import { useBlueprintUpload } from "../../hooks/useBlueprintUpload";
import {
  Upload,
  Eye,
  EyeOff,
  X,
  Move,
  Check,
  RotateCcw,
  RotateCw,
  Sparkles,
} from "lucide-react";

export function ImageOverlayControl({
  overlayImage,
  importCount = 0,
  roadLabelCount = 0,
  importWarnings = [],
  hasImportSource = false,
  importMessage = "",
  importError = "",
  isPreparingOverlay = false,
  onReviewImport,
  previewImport = false,
  onToggleImportPreview,
  overlayOpacity = 1,
  overlayVisible,
  isEditingOverlay,
  overlayRotation = 0,
  overlayMultiply = true,
  overlayWhiteLines = true,
  overlayLineColor = "lime",
  overlayLineBoldness = "super_fine",
  onToggleWhiteLines,
  onLineColorChange,
  onLineBoldnessChange,
  isBulkShifting = false,
  onImageUpload,
  onOpacityChange,
  onRotationChange,
  onRotate90,
  onReset,
  onToggleMultiply,
  onScaleOverlay,
  onFitToView,
  onOpenCrop,
  onToggleVisible,
  onToggleEdit,
  onRemove,
  onClose,
}) {
  const fileInputRef = useRef(null);
  const { uploadStage, uploadError, handleFileChange } = useBlueprintUpload(onImageUpload);
  const isConvertingPdf = Boolean(uploadStage);

  return (
    <div
      className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-xl border border-slate-700/70 rounded-2xl shadow-2xl p-4 w-80 transition-all duration-200 overflow-y-auto text-slate-200"
      style={{ zIndex: 1000, maxHeight: "calc(100vh - 6rem)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.9)]"></div>
          <h3 className="font-bold text-white text-sm tracking-wide">
            Subdivision Blueprint
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          {overlayImage && onToggleVisible && (
            <button
              type="button"
              onClick={onToggleVisible}
              className={`p-1 rounded-lg border transition-all cursor-pointer ${
                overlayVisible
                  ? "bg-slate-800 border-slate-700 text-cyan-400 hover:text-white"
                  : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-400"
              }`}
              title={overlayVisible ? "Hide Blueprint" : "Show Blueprint"}
            >
              {overlayVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-slate-800 transition-all rounded-lg p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {uploadError && <p role="alert" className="mt-3 text-xs text-rose-300">{uploadError}</p>}
      {importError && <p role="alert" className="mt-3 text-xs text-rose-300">{importError}</p>}
      {importMessage && <p role="status" className="mt-3 text-xs text-emerald-300">{importMessage}</p>}

      {/* No image uploaded yet */}
      {!overlayImage ? (
        <div className="pt-3">
          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            Upload your subdivision site plan (PDF, PNG, JPG) to overlay CAD lines directly onto the satellite map.
          </p>

          {isConvertingPdf ? (
            <div className="w-full flex flex-col items-center justify-center gap-2 py-6 border border-dashed border-indigo-500/40 bg-indigo-500/10 rounded-xl text-indigo-300">
              <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-b-2 border-indigo-400"></div>
              <span className="text-xs font-semibold">{uploadStage}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 border border-dashed border-indigo-500/50 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded-xl transition-all text-xs font-semibold shadow-sm active:scale-95 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Site Plan (PDF / Image)</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      ) : (
        /* Image loaded - Sleek Executive Controls */
        <fieldset disabled={isPreparingOverlay || isConvertingPdf} className="pt-3 space-y-3 disabled:opacity-70">
          {hasImportSource && (
            <div className="space-y-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3">
              <p className="text-xs font-semibold text-cyan-200">{importCount} candidate lots in frame</p>
              {roadLabelCount > 0 && (
                <p className="text-[11px] font-semibold text-slate-300">
                  {isEditingOverlay
                    ? `${roadLabelCount} road labels will be added when alignment is locked.`
                    : 'Automatic road labels are ready. Edit them in Road Labels.'}
                </p>
              )}
              {importCount > 0 && (
                <button
                  type="button"
                  onClick={onReviewImport}
                  disabled={isConvertingPdf || isPreparingOverlay}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-2.5 text-xs font-bold text-slate-950 shadow-md transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Review & Create Lots</span>
                </button>
              )}
            </div>
          )}
          {!hasImportSource && (
            <p className="text-xs text-slate-400">
              Upload a PDF to detect lot boundaries automatically. Images remain available for manual tracing.
            </p>
          )}

          {/* 2. Visual Style & Color Card */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3 space-y-3">
            {/* Transparent Paper Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-white" />
                <span>Transparent Paper</span>
              </span>
              <button
                type="button"
                onClick={onToggleMultiply}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                  overlayMultiply
                    ? "bg-white/20 text-white border-white/40 shadow-sm"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
                }`}
              >
                {overlayMultiply ? "ENABLED" : "OFF"}
              </button>
            </div>
          </div>

          {/* 3. Orientation & Angle Slider Card */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Orientation</span>
              <div className="flex items-center gap-1.5">
                <div className="relative flex items-center">
                  <input
                    id="overlay-rotation-number"
                    name="overlay_rotation"
                    aria-label="Site plan rotation angle in degrees"
                    type="number"
                    min="-180"
                    max="180"
                    step="0.5"
                    value={overlayRotation}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onRotationChange(isNaN(val) ? 0 : val);
                    }}
                    className="w-16 px-1.5 py-0.5 text-center text-xs font-mono font-bold text-white bg-slate-900/90 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    title="Type exact rotation angle in degrees"
                  />
                  <span className="text-xs font-mono text-slate-400 -ml-4 pr-1 pointer-events-none">°</span>
                </div>
                <button
                  type="button"
                  onClick={onReset || (() => onRotationChange(0))}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-semibold rounded-lg transition-all active:scale-95 cursor-pointer"
                  title="Reset rotation to 0°"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Quick Turn & Fine Nudge Buttons */}
            <div className="grid grid-cols-6 gap-1 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  let next = Math.round(overlayRotation) - 90;
                  if (next < -180) next += 360;
                  onRotationChange(next);
                }}
                className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 text-[10px] font-semibold rounded-lg flex items-center justify-center gap-0.5 transition-all active:scale-95 cursor-pointer"
                title="Rotate 90° counter-clockwise"
              >
                <RotateCcw className="w-2.5 h-2.5" /> -90°
              </button>
              <button
                type="button"
                onClick={() => {
                  let next = Math.round(overlayRotation) - 5;
                  if (next < -180) next += 360;
                  onRotationChange(next);
                }}
                className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 text-[10px] font-semibold rounded-lg transition-all active:scale-95 cursor-pointer"
                title="Nudge -5°"
              >
                -5°
              </button>
              <button
                type="button"
                onClick={() => {
                  let next = Math.round(overlayRotation) - 1;
                  if (next < -180) next += 360;
                  onRotationChange(next);
                }}
                className="py-1.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-[10px] font-bold rounded-lg transition-all active:scale-95 cursor-pointer shadow-sm"
                title="Fine-tune -1°"
              >
                -1°
              </button>
              <button
                type="button"
                onClick={() => {
                  let next = Math.round(overlayRotation) + 1;
                  if (next > 180) next -= 360;
                  onRotationChange(next);
                }}
                className="py-1.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-[10px] font-bold rounded-lg transition-all active:scale-95 cursor-pointer shadow-sm"
                title="Fine-tune +1°"
              >
                +1°
              </button>
              <button
                type="button"
                onClick={() => {
                  let next = Math.round(overlayRotation) + 5;
                  if (next > 180) next -= 360;
                  onRotationChange(next);
                }}
                className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 text-[10px] font-semibold rounded-lg transition-all active:scale-95 cursor-pointer"
                title="Nudge +5°"
              >
                +5°
              </button>
              <button
                type="button"
                onClick={() => {
                  let next = Math.round(overlayRotation) + 90;
                  if (next > 180) next -= 360;
                  onRotationChange(next);
                }}
                className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 text-[10px] font-semibold rounded-lg flex items-center justify-center gap-0.5 transition-all active:scale-95 cursor-pointer"
                title="Rotate 90° clockwise"
              >
                <RotateCw className="w-2.5 h-2.5" /> +90°
              </button>
            </div>
          </div>

          {/* 5. Main Action: Lock or Edit Alignment */}
          <div className="pt-1 space-y-2">
            <button
              type="button"
              onClick={onToggleEdit}
              disabled={isPreparingOverlay || isConvertingPdf}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer ${
                isEditingOverlay
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25 ring-2 ring-emerald-400/40"
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25"
              }`}
            >
              {isEditingOverlay ? <Check className="w-4 h-4" /> : <Move className="w-4 h-4" />}
              <span>{isEditingOverlay ? "Done Aligning (Lock Blueprint)" : "Adjust & Move Blueprint"}</span>
            </button>
          </div>

          {/* 6. Footer Utilities */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
            {isConvertingPdf ? (
              <span className="text-white animate-pulse">{uploadStage}</span>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-slate-400 hover:text-slate-200 transition-colors underline cursor-pointer"
              >
                Replace file
              </button>
            )}

            <button
              type="button"
              onClick={onRemove}
              className="text-red-400 hover:text-red-300 hover:bg-red-950/30 px-2 py-1 rounded-lg transition-colors cursor-pointer"
              title="Remove blueprint overlay"
            >
              Remove
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
        </fieldset>
      )}
    </div>
  );
}
