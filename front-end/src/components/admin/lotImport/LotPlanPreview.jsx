import React, { useEffect, useRef, useState } from "react";
import { Maximize, Minus, Plus } from "lucide-react";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const sourceWidth = 1000;

const NON_SALEABLE_STYLE = {
  name: "Non-Saleable Area",
  fillSelected: "#a855f7",
  fillUnselected: "#581c87",
  strokeSelected: "#7c3aed",
  strokeUnselected: "#a855f7",
};

export const CATEGORY_STYLES = {
  residential: {
    name: "Saleable Lot",
    fillSelected: "#10b981",
    fillUnselected: "#064e3b",
    strokeSelected: "#059669",
    strokeUnselected: "#10b981",
  },
  non_saleable: NON_SALEABLE_STYLE,
  park: NON_SALEABLE_STYLE,
  facility: NON_SALEABLE_STYLE,
  excluded: NON_SALEABLE_STYLE,
  open_space: NON_SALEABLE_STYLE,
};

export default function LotPlanPreview({ candidates, activeId, focusRequest, imageUrl, pageWidth, pageHeight, onActivate, onUpdate, disabled }) {
  const svgRef = useRef(null);
  const gesture = useRef(null);
  const [imageAspect, setImageAspect] = useState(0.707);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1000, height: 707 });
  const aspect = pageWidth > 0 && pageHeight > 0 ? pageHeight / pageWidth : imageAspect;
  const sourceHeight = sourceWidth * aspect;
  const viewWidth = sourceWidth / zoom;
  const viewHeight = sourceHeight / zoom;
  const renderScale = Math.max(0.01, Math.min(canvasSize.width / viewWidth, canvasSize.height / viewHeight));
  const viewCenter = center || { x: sourceWidth / 2, y: sourceHeight / 2 };
  const activeCandidate = candidates.find((candidate) => candidate.id === activeId);
  const lastFocusRequest = useRef(null);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width && entry.contentRect.height) setCanvasSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(svgRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!imageUrl) return undefined;
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth) setImageAspect(image.naturalHeight / image.naturalWidth);
    };
    image.src = imageUrl;
    return () => { image.onload = null; };
  }, [imageUrl]);

  useEffect(() => {
    if (!focusRequest || lastFocusRequest.current === focusRequest || !activeCandidate?.points?.length) return;
    lastFocusRequest.current = focusRequest;
    const xs = activeCandidate.points.map(([x]) => x);
    const ys = activeCandidate.points.map(([, y]) => y);
    const left = Math.min(...xs), right = Math.max(...xs);
    const top = Math.min(...ys), bottom = Math.max(...ys);
    setZoom(clamp(0.6 / Math.max(right - left, bottom - top, 0.025), 1, 24));
    setCenter({ x: (left + right) * sourceWidth / 2, y: (top + bottom) * sourceHeight / 2 });
  }, [focusRequest, activeCandidate, sourceHeight]);

  const toSourcePoint = (event) => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return null;
    const point = svgRef.current.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(matrix.inverse());
  };

  const updateVertex = (candidateId, pointIndex, x, y) => {
    const candidate = candidates.find((item) => item.id === candidateId);
    if (!candidate || disabled) return;
    onUpdate(candidateId, {
      points: candidate.points.map((point, index) => index === pointIndex ? [clamp(x, 0, 1), clamp(y, 0, 1)] : point),
    });
  };

  const startGesture = (event, pointIndex) => {
    if (disabled || event.button !== 0) return;
    const point = toSourcePoint(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    svgRef.current.setPointerCapture(event.pointerId);
    gesture.current = pointIndex === undefined
      ? { type: "pan", point }
      : { type: "vertex", candidateId: activeId, pointIndex };
  };

  const moveGesture = (event) => {
    if (!gesture.current || disabled) return;
    const point = toSourcePoint(event);
    if (!point) return;
    if (gesture.current.type === "vertex") {
      updateVertex(gesture.current.candidateId, gesture.current.pointIndex, point.x / sourceWidth, point.y / sourceHeight);
      return;
    }
    const deltaX = point.x - gesture.current.point.x;
    const deltaY = point.y - gesture.current.point.y;
    setCenter({ x: clamp(viewCenter.x - deltaX, 0, sourceWidth), y: clamp(viewCenter.y - deltaY, 0, sourceHeight) });
  };

  const moveVertexWithKey = (event, index) => {
    if (!activeCandidate || disabled) return;
    const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = (event.shiftKey ? 0.01 : 0.002) / zoom;
    const [x, y] = activeCandidate.points[index];
    updateVertex(activeId, index, x + direction[0] * step, y + direction[1] * step);
  };

  const stopGesture = () => { gesture.current = null; };
  const resetView = () => { setZoom(1); setCenter(null); };
  const controlClass = "flex h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50";

  return (
    <div className="flex h-full min-h-80 min-w-0 flex-col bg-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 p-3">
        <span className="text-xs font-medium text-slate-300">Source plan · {Math.round(zoom * 100)}%</span>
        <div className="flex gap-2">
          <button type="button" aria-label="Zoom out of plan" disabled={disabled || zoom <= 1} onClick={() => setZoom((value) => Math.max(1, value / 1.5))} className={controlClass}><Minus className="h-4 w-4" /></button>
          <button type="button" aria-label="Zoom into plan" disabled={disabled || zoom >= 24} onClick={() => setZoom((value) => Math.min(24, value * 1.5))} className={controlClass}><Plus className="h-4 w-4" /></button>
          <button type="button" disabled={disabled} onClick={resetView} className={controlClass}><Maximize className="h-4 w-4" />Fit plan</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-slate-700/80 bg-slate-900/90 px-3 py-1.5 text-[11px] text-slate-300">
        <span className="font-semibold text-slate-400">Legend:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-emerald-400 bg-emerald-500/40" />
          Saleable Lots (Green)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-purple-400 bg-purple-500/40" />
          Non-Saleable Areas (Purple)
        </span>
      </div>
      <svg ref={svgRef} viewBox={`${viewCenter.x - viewWidth / 2} ${viewCenter.y - viewHeight / 2} ${viewWidth} ${viewHeight}`}
        className="w-full flex-1 touch-none" style={{ minHeight: "20rem", cursor: disabled ? "default" : "grab" }}
        aria-label="Detected lot boundaries on source plan" role="group"
        onPointerDown={(event) => startGesture(event)} onPointerMove={moveGesture}
        onPointerUp={stopGesture} onPointerCancel={stopGesture} onLostPointerCapture={stopGesture}>
        <rect x="0" y="0" width={sourceWidth} height={sourceHeight} fill="#e2e8f0" />
        {imageUrl && <image href={imageUrl} x="0" y="0" width={sourceWidth} height={sourceHeight} preserveAspectRatio="none" pointerEvents="none" />}
        {candidates.map((candidate, index) => {
          if (!candidate.points?.length) return null;
          const active = candidate.id === activeId;
          const isNonSaleable = Boolean(candidate.nonSaleable);
          const style = isNonSaleable ? CATEGORY_STYLES.non_saleable : CATEGORY_STYLES.residential;
          const fill = active
            ? (isNonSaleable ? style.strokeSelected : "#059669")
            : candidate.selected
            ? style.fillSelected
            : isNonSaleable
            ? style.fillUnselected
            : "#064e3b";
          const fillOpacity = active ? 0.52 : candidate.selected ? 0.35 : isNonSaleable ? 0.25 : 0.12;
          const stroke = active
            ? "#f97316"
            : candidate.selected
            ? style.strokeSelected
            : isNonSaleable
            ? style.strokeUnselected
            : "#10b981";
          const strokeWidth = active ? 2.5 : isNonSaleable ? 2 : 1.5;
          const strokeDasharray = candidate.selected ? undefined : isNonSaleable ? "5 3" : undefined;
          const points = candidate.points.map(([x, y]) => [x * sourceWidth, y * sourceHeight]);
          const centroid = points.reduce(([x, y], point) => [x + point[0] / points.length, y + point[1] / points.length], [0, 0]);
          return (
            <g key={candidate.id}>
              <polygon points={points.map((point) => point.join(",")).join(" ")}
                fill={fill}
                fillOpacity={fillOpacity}
                stroke={stroke}
                strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke"
                strokeDasharray={strokeDasharray}
                role="button" tabIndex={disabled ? -1 : 0} aria-label={`Show candidate ${index + 1}`} aria-pressed={active}
                style={{ cursor: disabled ? "default" : "pointer" }}
                onPointerDown={(event) => { event.stopPropagation(); if (!disabled) onActivate(candidate.id); }}
                onKeyDown={(event) => { if (!disabled && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onActivate(candidate.id); } }} />
              <text x={centroid[0]} y={centroid[1]} textAnchor="middle" dominantBaseline="central"
                fontSize={clamp(10 / zoom, 1.5, 10)} fill="#0f172a" stroke="#f8fafc" strokeWidth={2 / zoom}
                paintOrder="stroke" fontWeight="700" pointerEvents="none">{index + 1}</text>
            </g>
          );
        })}
        {activeCandidate?.points.map(([x, y], index) => (
          <g key={index}>
            <circle cx={x * sourceWidth} cy={y * sourceHeight} r={22 / renderScale}
              fill="transparent" role="button" tabIndex={disabled ? -1 : 0} aria-label={`Move corner ${index + 1} of active boundary with arrow keys`}
              style={{ cursor: disabled ? "default" : "move" }} onPointerDown={(event) => startGesture(event, index)}
              onKeyDown={(event) => moveVertexWithKey(event, index)} />
            <circle cx={x * sourceWidth} cy={y * sourceHeight} r={5 / renderScale} pointerEvents="none"
              fill="#fff7ed" stroke="#ea580c" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </svg>
      <p className="border-t border-slate-700 p-3 text-xs leading-relaxed text-slate-300">
        Click a lot to inspect it. Drag its orange corner handles to correct the boundary, or focus a handle and use arrow keys. Drag empty space to pan.
      </p>
    </div>
  );
}
