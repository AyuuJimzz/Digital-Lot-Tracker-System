import React, { useRef } from "react";
import { Upload, Eye, EyeOff, X, Move } from "lucide-react";

export function ImageOverlayControl({
  overlayImage,
  overlayOpacity,
  overlayVisible,
  isEditingOverlay,
  overlayRotation = 0,
  isBulkShifting = false,
  onImageUpload,
  onOpacityChange,
  onRotationChange,
  onFitToView,
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
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
        resolve(window.pdfjsLib);
      };
      script.onerror = () => reject(new Error("Failed to load PDF converter library"));
      document.head.appendChild(script);
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check if it is a PDF
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

              // Render first page at high scale (2.5x) for maximum visual clarity on the map
              const viewport = page.getViewport({ scale: 2.5 });
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

    // Default image validation
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
      className="absolute top-4 left-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl p-4 w-72 transition-all duration-300 overflow-y-auto"
      style={{ zIndex: 1000, maxHeight: "calc(100vh - 6rem)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 border-b border-gray-100 dark:border-slate-800 pb-2">
        <h3 className="font-semibold text-gray-800 dark:text-white text-sm flex items-center gap-1.5">
          <span>📎</span> Site Plan Overlay
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors rounded-full p-0.5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* No image uploaded yet */}
      {!overlayImage ? (
        <div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-3 leading-relaxed">
            Upload a <strong>PNG, JPG, or PDF file</strong> of your site development plan. If you upload a PDF, we will automatically convert the first page to a high-resolution image to overlay on the map.
          </p>

          {isConvertingPdf ? (
            <div className="w-full flex flex-col items-center justify-center gap-2 py-4 border-2 border-dashed border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-950/10 rounded-lg text-purple-600 dark:text-purple-400">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
              <span className="text-xs font-semibold">Converting PDF to Image...</span>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              Upload Site Plan (Image / PDF)
            </button>
          )}

          <p className="text-xs text-gray-400 dark:text-slate-500 mt-2 text-center">
            PNG, JPG, WebP, PDF supported
          </p>

          <div className="mt-3 bg-gray-50 dark:bg-slate-800 rounded-lg p-2.5">
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
              💡 <strong>Tip:</strong> PDF plans will be rendered with high clarity so you can zoom in and trace accurately.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      ) : (
        /* Image loaded - show controls */
        <div className="space-y-3">
          {/* Opacity Slider */}
          <div>
            <label className="flex justify-between text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              <span>Opacity</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold">
                {Math.round(overlayOpacity * 100)}%
              </span>
            </label>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={overlayOpacity}
              onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500 mt-0.5">
              <span>Transparent</span>
              <span>Solid</span>
            </div>
          </div>

          {/* Rotation Slider */}
          <div>
            <label className="flex justify-between text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              <span>🔄 Rotation</span>
              <span className="text-purple-600 dark:text-purple-400 font-semibold">{overlayRotation}°</span>
            </label>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={overlayRotation}
              onChange={(e) => onRotationChange(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500 mt-0.5">
              <span>-180°</span>
              <button
                onClick={() => onRotationChange(0)}
                className="text-purple-500 hover:text-purple-700 underline"
              >
                Reset
              </button>
              <span>+180°</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            {/* Show/Hide */}
            <button
              onClick={onToggleVisible}
              title={overlayVisible ? "Hide overlay" : "Show overlay"}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                overlayVisible
                  ? "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-700"
                  : "bg-slate-700 text-white border-slate-700 hover:bg-slate-600"
              }`}
            >
              {overlayVisible ? (
                <Eye className="w-3 h-3" />
              ) : (
                <EyeOff className="w-3 h-3" />
              )}
              {overlayVisible ? "Visible" : "Hidden"}
            </button>
          </div>

          <div className="flex gap-2">
            {/* Align corners mode */}
            <button
              onClick={onToggleEdit}
              title="Drag corners to align image with the map"
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                isEditingOverlay
                  ? "bg-amber-500 text-white border-amber-500 hover:bg-amber-600"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-700"
              }`}
            >
              <Move className="w-3 h-3" />
              {isEditingOverlay ? "Done Aligning" : "Align Image"}
            </button>

            {/* Remove */}
            <button
              onClick={onRemove}
              title="Remove overlay"
              className="flex items-center justify-center w-8 h-8 text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bulk Shift Lots Toggle */}
          <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
            <button
              onClick={onToggleBulkShift}
              title="Shift all existing lots together to align them with the site plan"
              className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
                isBulkShifting
                  ? "bg-red-600 text-white border-red-600 hover:bg-red-700 shadow-md animate-pulse"
                  : "bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900 hover:bg-purple-100 dark:hover:bg-purple-950/40"
              }`}
            >
              <Move className="w-3.5 h-3.5" />
              {isBulkShifting ? "Done Bulk Aligning" : "⚡ Bulk Align Traced Lots"}
            </button>
          </div>

          {/* Replace image */}
          {isConvertingPdf ? (
            <div className="w-full text-xs text-purple-600 dark:text-purple-400 text-center font-medium animate-pulse pt-1">
              ⏳ Converting PDF to Image...
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors underline text-center pt-1"
            >
              Replace image
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
      )}
    </div>
  );
}
