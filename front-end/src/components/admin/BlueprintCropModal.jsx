import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Check, PenTool, Hand, Undo, Trash2, ZoomIn, ZoomOut, RotateCcw, HelpCircle } from "lucide-react";

export function BlueprintCropModal({ isOpen, imageUrl, onApplyCrop, onClose }) {
  // Current active mode: 'trace' (drop points) | 'pan' (drag screen)
  const [tool, setTool] = useState("trace");

  // Polygon points in % (0 - 100) relative to image natural dimensions
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [draggingPointIndex, setDraggingPointIndex] = useState(null);

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);

  const imgRef = useRef(null);
  const workspaceRef = useRef(null);
  const panStartRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPolygonPoints([]);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setTool("trace");
    }
  }, [isOpen]);

  // Spacebar pan toggle & Ctrl+Z Undo
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.code === "Space" && !spacePressed && e.target === document.body) {
        e.preventDefault();
        setSpacePressed(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        setPolygonPoints((prev) => prev.slice(0, -1));
      }
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === "Space") {
        setSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isOpen, spacePressed, onClose]);

  // Mouse wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((prev) => {
      const next = Math.max(0.6, Math.min(5, Number((prev * zoomFactor).toFixed(2))));
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(5, Number((prev * 1.25).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(0.6, Number((prev / 1.25).toFixed(2)));
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // ── Mouse Pointer Down (Pan or Point Click) ───────────────────────────────────
  const handlePointerDown = (e) => {
    // If holding space, or tool is 'pan', or middle/right click -> Start Panning
    if (spacePressed || tool === "pan" || e.button === 1 || e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initPan: { ...pan },
      };
      return;
    }

    // Otherwise in 'trace' mode on left-click: place a point
    if (e.button === 0 && imgRef.current && draggingPointIndex === null) {
      const rect = imgRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
        setPolygonPoints((prev) => [...prev, { x, y }]);
      }
    }
  };

  const handlePointPointerDown = (index, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingPointIndex(index);
  };

  const handlePointerMove = useCallback(
    (e) => {
      // 1. Dragging a specific point
      if (draggingPointIndex !== null && imgRef.current) {
        const rect = imgRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

        setPolygonPoints((prev) => {
          const next = [...prev];
          next[draggingPointIndex] = { x, y };
          return next;
        });
        return;
      }

      // 2. Panning screen
      if (isPanning && panStartRef.current) {
        const deltaX = e.clientX - panStartRef.current.startX;
        const deltaY = e.clientY - panStartRef.current.startY;
        setPan({
          x: panStartRef.current.initPan.x + deltaX,
          y: panStartRef.current.initPan.y + deltaY,
        });
      }
    },
    [draggingPointIndex, isPanning]
  );

  const handlePointerUp = useCallback(() => {
    if (draggingPointIndex !== null) setDraggingPointIndex(null);
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
    }
  }, [draggingPointIndex, isPanning]);

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  // ── Apply Polygon Cutout ─────────────────────────────────────────────────────
  const handleApply = () => {
    if (!imageUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const origW = img.naturalWidth;
      const origH = img.naturalHeight;

      if (polygonPoints.length >= 3) {
        // Calculate Bounding Box of the Polygon
        let minX = 100,
          minY = 100,
          maxX = 0,
          maxY = 0;
        polygonPoints.forEach((p) => {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        });

        // Add 1.5% margin padding
        minX = Math.max(0, minX - 1.5);
        minY = Math.max(0, minY - 1.5);
        maxX = Math.min(100, maxX + 1.5);
        maxY = Math.min(100, maxY + 1.5);

        const cropPixelX = (minX / 100) * origW;
        const cropPixelY = (minY / 100) * origH;
        const cropPixelW = ((maxX - minX) / 100) * origW;
        const cropPixelH = ((maxY - minY) / 100) * origH;

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(10, Math.round(cropPixelW));
        canvas.height = Math.max(10, Math.round(cropPixelH));
        const ctx = canvas.getContext("2d");

        // Create polygon clipping path relative to the cropped bounding box
        ctx.beginPath();
        polygonPoints.forEach((p, idx) => {
          const ptX = (p.x / 100) * origW - cropPixelX;
          const ptY = (p.y / 100) * origH - cropPixelY;
          if (idx === 0) ctx.moveTo(ptX, ptY);
          else ctx.lineTo(ptX, ptY);
        });
        ctx.closePath();
        ctx.clip(); // Clips all outside drawings/tables/insets to 100% transparent!

        // Draw image offset
        ctx.drawImage(img, -cropPixelX, -cropPixelY);

        canvas.toBlob((blob) => {
          if (!blob) return;
          const croppedUrl = URL.createObjectURL(blob);
          onApplyCrop(croppedUrl, {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX,
            height: maxY - minY,
          });
          onClose();
        }, "image/png");
      } else {
        // If less than 3 points, apply full image as fallback
        onApplyCrop(imageUrl, { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 });
        onClose();
      }
    };
    img.src = imageUrl;
  };

  if (!isOpen || !imageUrl) return null;

  const isCurrentPanning = isPanning || spacePressed || tool === "pan";

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200"
      style={{ zIndex: 999999 }}
    >
      <div className="bg-slate-900 border border-slate-700/90 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden text-slate-200 relative">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/95 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30">
              <PenTool className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Trace Subdivision Boundary</h3>
              <p className="text-[11px] text-slate-400">
                Click around the lots to trace. Everything outside will be cut away.
              </p>
            </div>
          </div>

          {/* Mode & Navigation Controls */}
          <div className="flex items-center gap-2">
            {/* Tool Switcher */}
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => setTool("trace")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  tool === "trace"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Click on the blueprint to add trace points"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>✏️ Trace</span>
              </button>
              <button
                type="button"
                onClick={() => setTool("pan")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  tool === "pan"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Click and drag to pan/move around the screen"
              >
                <Hand className="w-3.5 h-3.5" />
                <span>✋ Move Screen</span>
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-bold text-slate-200 px-1 min-w-[2.8rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetView}
                className="p-1 hover:bg-slate-700 rounded-lg text-blue-400 transition-colors cursor-pointer"
                title="Reset View (100%)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tip Banner */}
        <div className="px-5 py-1.5 bg-blue-950/40 border-b border-blue-900/40 flex items-center justify-between text-[11px] text-blue-300">
          <span className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>
              <strong>Tip:</strong> Mag-scroll para mag-zoom. I-hold ang <strong>Spacebar</strong> o piliin ang <strong>Move Screen</strong> para i-drag at ilipat ang view.
            </span>
          </span>
          <span className="text-slate-400 font-mono">
            {polygonPoints.length} points placed
          </span>
        </div>

        {/* Interactive Workspace Area */}
        <div
          ref={workspaceRef}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onContextMenu={(e) => e.preventDefault()}
          className="flex-1 overflow-hidden bg-slate-950 flex items-center justify-center select-none relative"
          style={{
            touchAction: "none",
            cursor: isCurrentPanning
              ? "grab"
              : "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Cpath stroke='%23000' stroke-width='4' stroke-linecap='round' d='M14 2v24M2 14h24'/%3E%3Cpath stroke='%2338bdf8' stroke-width='2' stroke-linecap='round' d='M14 2v24M2 14h24'/%3E%3Ccircle cx='14' cy='14' r='3.5' fill='%23ffffff' stroke='%23000' stroke-width='1.5'/%3E%3C/svg%3E\") 14 14, crosshair",
          }}
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              transition: isPanning || draggingPointIndex !== null ? "none" : "transform 0.1s ease-out",
            }}
            className="relative inline-block max-w-full max-h-[70vh] rounded-lg shadow-2xl"
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Blueprint trace workspace"
              className="max-h-[70vh] w-auto object-contain block pointer-events-none rounded-lg border border-slate-800"
              draggable={false}
            />

            {/* SVG Connecting Polygon & Glowing Lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {polygonPoints.length >= 2 && (
                <polygon
                  points={polygonPoints.map((p) => `${p.x}%,${p.y}%`).join(" ")}
                  fill="rgba(59, 130, 246, 0.2)"
                  stroke="#38bdf8"
                  strokeWidth={2 / zoom}
                  strokeDasharray="4 3"
                />
              )}
              {polygonPoints.map((p, idx) => {
                if (idx === 0) return null;
                const prev = polygonPoints[idx - 1];
                return (
                  <line
                    key={idx}
                    x1={`${prev.x}%`}
                    y1={`${prev.y}%`}
                    x2={`${p.x}%`}
                    y2={`${p.y}%`}
                    stroke="#38bdf8"
                    strokeWidth={2 / zoom}
                  />
                );
              })}
            </svg>

            {/* Sleek Pinpoint Dots (Scaled dynamically with zoom so they remain small & precise) */}
            {polygonPoints.map((p, idx) => (
              <div
                key={idx}
                onPointerDown={(e) => handlePointPointerDown(idx, e)}
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  transform: `translate(-50%, -50%) scale(${1 / Math.max(1, zoom * 0.7)})`,
                }}
                className="absolute w-3 h-3 bg-cyan-400 border-2 border-white rounded-full shadow-[0_0_8px_rgba(56,189,248,0.9)] cursor-grab active:cursor-grabbing hover:scale-150 transition-transform pointer-events-auto"
                title={`Point ${idx + 1} (Drag to adjust)`}
              />
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-900/95 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPolygonPoints((prev) => prev.slice(0, -1))}
              disabled={polygonPoints.length === 0}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              title="Undo last point (or press Ctrl+Z)"
            >
              <Undo className="w-3.5 h-3.5 text-blue-400" /> Undo Point (Ctrl+Z)
            </button>
            <button
              type="button"
              onClick={() => setPolygonPoints([])}
              disabled={polygonPoints.length === 0}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-red-400 text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Points ({polygonPoints.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={polygonPoints.length > 0 && polygonPoints.length < 3}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>
                {polygonPoints.length >= 3
                  ? `Apply Traced Cutout (${polygonPoints.length} Points)`
                  : "Apply Full Blueprint"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
