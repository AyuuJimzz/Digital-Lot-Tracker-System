import React, { useRef } from "react";
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
  Crop,
} from "lucide-react";

export function ImageOverlayControl({
  overlayImage,
  overlayOpacity,
  overlayVisible,
  isEditingOverlay,
  overlayRotation = 0,
  overlayMultiply = true,
  overlayWhiteLines = true,
  overlayLineColor = "cyan",
  onToggleWhiteLines,
  onLineColorChange,
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
  onToggleBulkShift,
  onRemove,
  onClose,
}) {
  const fileInputRef = useRef(null);
  const [isConvertingPdf, setIsConvertingPdf] = React.useState(false);

  const loadPdfJs = () => {
    return new Promise((resolve, reject) => {
      if (window.pdfjsLib) {
        resolve(window.pdfjsLib);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js";
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
        resolve(window.pdfjsLib);
      };
      script.onerror = () => reject(new Error("Failed to load PDF converter library"));
      document.head.appendChild(script);
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type === "application/pdf") {
      setIsConvertingPdf(true);
      loadPdfJs()
        .then(async (pdfjs) => {
          const reader = new FileReader();
          reader.onload = async function () {
            try {
              const arrayBuffer = this.result;
              const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
              const page = await pdf.getPage(1);

              const viewport = page.getViewport({ scale: 3.5 });
              const canvas = document.createElement("canvas");
              const context = canvas.getContext("2d");
              canvas.height = viewport.height;
              canvas.width = viewport.width;

              await page.render({
                canvasContext: context,
                viewport: viewport,
              }).promise;

              canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                onImageUpload(url);
                setIsConvertingPdf(false);
              }, "image/png");
            } catch (err) {
              console.error("PDF conversion error:", err);
              alert("Failed to convert PDF. Please make sure it's a valid PDF file.");
              setIsConvertingPdf(false);
            }
          };
          reader.readAsArrayBuffer(file);
        })
        .catch((err) => {
          console.error("PDF.js loading error:", err);
          alert("Failed to load PDF converter library. Please check your internet connection.");
          setIsConvertingPdf(false);
        });

      e.target.value = "";
      return;
    }

    if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/)) {
      alert("Please upload a PNG, JPG, WebP image, or a PDF file.");
      return;
    }

    const url = URL.createObjectURL(file);
    onImageUpload(url);
    e.target.value = "";
  };

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
            Site Plan Blueprint Overlay
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white hover:bg-slate-800 transition-all rounded-lg p-1 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* No image uploaded yet */}
      {!overlayImage ? (
        <div className="pt-3">
          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            Upload your subdivision site plan (PDF, PNG, JPG) to overlay CAD lines directly onto the satellite map.
          </p>

          {isConvertingPdf ? (
            <div className="w-full flex flex-col items-center justify-center gap-2 py-6 border border-dashed border-indigo-500/40 bg-indigo-500/10 rounded-xl text-indigo-300">
              <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-b-2 border-indigo-400"></div>
              <span className="text-xs font-semibold">Converting PDF to Map Layer...</span>
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
        <div className="pt-3 space-y-3">
          {/* 1. Primary Action: Crop / Frame Blueprint */}
          {onOpenCrop && (
            <button
              type="button"
              onClick={onOpenCrop}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-500/50 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-sm"
              title="Cut away outside tables and borders"
            >
              <Crop className="w-4 h-4 text-blue-400" />
              <span>Crop & Frame Subdivision Lots</span>
            </button>
          )}

          {/* 2. Visual Style & Color Card */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3 space-y-2.5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Line Color</span>
                <span className="text-[10px] text-cyan-400 font-semibold uppercase tracking-wider">High Contrast</span>
              </div>
              <div className="grid grid-cols-5 gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-700/80">
                <button
                  type="button"
                  onClick={() => onLineColorChange ? onLineColorChange("cyan") : onToggleWhiteLines && onToggleWhiteLines()}
                  className={`py-1.5 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                    overlayLineColor === "cyan"
                      ? "bg-cyan-500 text-slate-950 shadow-md font-extrabold ring-1 ring-cyan-300"
                      : "text-cyan-400 hover:bg-slate-800"
                  }`}
                  title="Cyan / Aqua (Best for Satellite Maps)"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 border border-slate-900"></span>
                  <span>Cyan</span>
                </button>
                <button
                  type="button"
                  onClick={() => onLineColorChange && onLineColorChange("amber")}
                  className={`py-1.5 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                    overlayLineColor === "amber"
                      ? "bg-amber-400 text-slate-950 shadow-md font-extrabold ring-1 ring-amber-200"
                      : "text-amber-400 hover:bg-slate-800"
                  }`}
                  title="Amber / Gold (Warm & High Visibility)"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-900"></span>
                  <span>Amber</span>
                </button>
                <button
                  type="button"
                  onClick={() => onLineColorChange && onLineColorChange("lime")}
                  className={`py-1.5 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                    overlayLineColor === "lime"
                      ? "bg-emerald-400 text-slate-950 shadow-md font-extrabold ring-1 ring-emerald-200"
                      : "text-emerald-400 hover:bg-slate-800"
                  }`}
                  title="Neon Lime (High Visibility)"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-900"></span>
                  <span>Lime</span>
                </button>
                <button
                  type="button"
                  onClick={() => onLineColorChange ? onLineColorChange("white") : onToggleWhiteLines && onToggleWhiteLines()}
                  className={`py-1.5 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                    overlayLineColor === "white" || (overlayWhiteLines && !overlayLineColor)
                      ? "bg-white text-slate-900 shadow-md font-extrabold ring-1 ring-slate-200"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                  title="Pure White"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-400"></span>
                  <span>White</span>
                </button>
                <button
                  type="button"
                  onClick={() => onLineColorChange ? onLineColorChange("black") : onToggleWhiteLines && onToggleWhiteLines()}
                  className={`py-1.5 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                    overlayLineColor === "black" || (!overlayWhiteLines && !overlayLineColor)
                      ? "bg-slate-700 text-white shadow-md font-extrabold ring-1 ring-slate-500"
                      : "text-slate-400 hover:bg-slate-800"
                  }`}
                  title="Dark / Black Ink"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-950 border border-slate-600"></span>
                  <span>Black</span>
                </button>
              </div>
            </div>

            {/* Brightness / Opacity Slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-400">Brightness</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">
                    {Math.round(overlayOpacity * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={onToggleVisible}
                    className={`p-1 rounded-md border transition-all cursor-pointer ${
                      overlayVisible
                        ? "bg-slate-700/80 border-slate-600 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-500"
                    }`}
                    title={overlayVisible ? "Hide Layer" : "Show Layer"}
                  >
                    {overlayVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={overlayOpacity}
                onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            {/* Transparent Paper Toggle */}
            <div className="pt-1 flex items-center justify-between border-t border-slate-700/40">
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
          <div className="pt-1">
            <button
              type="button"
              onClick={onToggleEdit}
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
              <span className="text-white animate-pulse">Converting...</span>
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
        </div>
      )}
    </div>
  );
}
