import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Maximize2, Minimize2, Minus, Pencil, Plus, RotateCcw } from "lucide-react";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const sourceWidth = 1000;

const NON_SALEABLE_STYLE = {
  name: "Non-Saleable Area",
  fillSelected: "#94a3b8",
  fillUnselected: "#475569",
  strokeSelected: "#475569",
  strokeUnselected: "#64748b",
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

export default function LotPlanPreview({
  candidates, activeId, focusRequest, imageUrl, pageWidth, pageHeight,
  onActivate, onUpdate, onDelete, onViewportChange, disabled, isExpanded = false, onToggleExpand,
  isEditingShape = false, onToggleEditShape, onAddManualCandidate,
  onRescan, isRescanning,
  onResetBoundary, canResetBoundary = false,
  initialViewport = null,
}) {
  const svgRef = useRef(null);
  const gesture = useRef(null);
  const [dragPoints, setDragPoints] = useState(null);
  const dragPointsRef = useRef(null);
  const [imageAspect, setImageAspect] = useState(0.707);
  const aspect = pageWidth > 0 && pageHeight > 0 ? pageHeight / pageWidth : imageAspect;
  const sourceHeight = sourceWidth * aspect;
  const [zoom, setZoom] = useState(() => (
    initialViewport?.zoom && initialViewport.zoom > 1 ? clamp(initialViewport.zoom, 1, 24) : 1
  ));
  const [center, setCenter] = useState(() => {
    if (initialViewport?.centerX != null && initialViewport?.centerY != null && initialViewport.isCustomView) {
      const initAspect = pageWidth > 0 && pageHeight > 0 ? pageHeight / pageWidth : 0.707;
      const initHeight = sourceWidth * initAspect;
      return {
        x: clamp(initialViewport.centerX * sourceWidth, 0, sourceWidth),
        y: clamp(initialViewport.centerY * initHeight, 0, initHeight),
      };
    }
    return null;
  });
  const [canvasSize, setCanvasSize] = useState({ width: 1000, height: 707 });
  const viewWidth = sourceWidth / zoom;
  const viewHeight = sourceHeight / zoom;
  const renderScale = Math.max(0.01, Math.min(canvasSize.width / viewWidth, canvasSize.height / viewHeight));
  const viewCenter = useMemo(() => center || { x: sourceWidth / 2, y: sourceHeight / 2 }, [center, sourceHeight]);
  const activeCandidate = candidates.find((candidate) => candidate.id === activeId);
  const activePoints = dragPoints || activeCandidate?.points;
  const lastFocusRequest = useRef(null);

  useEffect(() => {
    onViewportChange?.({
      centerX: viewCenter.x / sourceWidth,
      centerY: viewCenter.y / sourceHeight,
      viewWidthNorm: viewWidth / sourceWidth,
      viewHeightNorm: viewHeight / sourceHeight,
      zoom,
      isCustomView: Boolean(center || zoom > 1.05),
    });
  }, [viewCenter.x, viewCenter.y, viewWidth, viewHeight, zoom, sourceHeight, onViewportChange, center]);

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
    image.decoding = "async";
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

  const toSourcePoint = useCallback((event) => {
    const svg = svgRef.current;
    if (!svg) return null;
    if (typeof svg.getScreenCTM === "function" && typeof svg.createSVGPoint === "function") {
      const matrix = svg.getScreenCTM();
      if (matrix) {
        const point = svg.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        return point.matrixTransform(matrix.inverse());
      }
    }
    const rect = svg.getBoundingClientRect?.() || { left: 0, top: 0, width: canvasSize.width, height: canvasSize.height };
    const relX = (event.clientX - rect.left) / (rect.width || 1);
    const relY = (event.clientY - rect.top) / (rect.height || 1);
    return {
      x: (viewCenter.x - viewWidth / 2) + relX * viewWidth,
      y: (viewCenter.y - viewHeight / 2) + relY * viewHeight,
    };
  }, [canvasSize.width, canvasSize.height, viewCenter.x, viewCenter.y, viewWidth, viewHeight]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;

    const handleWheel = (event) => {
      if (disabled) return;
      event.preventDefault();
      event.stopPropagation();

      const point = toSourcePoint(event);
      const targetPoint = point || viewCenter;
      const zoomFactor = event.deltaY < 0 ? 1.25 : 1 / 1.25;

      setZoom((prevZoom) => {
        const nextZoom = clamp(prevZoom * zoomFactor, 1, 24);
        if (nextZoom === prevZoom) return prevZoom;

        if (nextZoom <= 1) {
          setCenter(null);
          return 1;
        }

        setCenter((prevCenter) => {
          const currentCenter = prevCenter || { x: sourceWidth / 2, y: sourceHeight / 2 };
          const ratio = prevZoom / nextZoom;
          const nextX = targetPoint.x - (targetPoint.x - currentCenter.x) * ratio;
          const nextY = targetPoint.y - (targetPoint.y - currentCenter.y) * ratio;
          return {
            x: clamp(nextX, 0, sourceWidth),
            y: clamp(nextY, 0, sourceHeight),
          };
        });

        return nextZoom;
      });
    };

    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [disabled, sourceHeight, toSourcePoint, viewCenter]);

  const updateVertex = (candidateId, pointIndex, x, y) => {
    const candidate = candidates.find((item) => item.id === candidateId);
    if (!candidate || disabled) return;
    onUpdate(candidateId, {
      points: candidate.points.map((point, index) => index === pointIndex ? [clamp(x, 0, 1), clamp(y, 0, 1)] : point),
    });
  };

  const midpointHandles = useMemo(() => {
    if (!activePoints || activePoints.length < 3) return [];
    const pts = activePoints;
    const n = pts.length;
    const mids = [];
    for (let i = 0; i < n; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      mids.push({
        x: (p1[0] + p2[0]) / 2,
        y: (p1[1] + p2[1]) / 2,
        insertIndex: i + 1,
      });
    }
    return mids;
  }, [activePoints]);

  const addVertexAtIndex = (insertIndex, midX, midY) => {
    if (!activeCandidate || disabled) return;
    const newPoints = [...(dragPoints || activeCandidate.points)];
    newPoints.splice(insertIndex, 0, [clamp(midX, 0, 1), clamp(midY, 0, 1)]);
    onUpdate(activeId, { points: newPoints });
  };

  const removeVertexAtIndex = (index) => {
    if (!activeCandidate || disabled) return;
    const basePts = dragPointsRef.current || dragPoints || activeCandidate.points;
    if (basePts.length <= 3) return;
    const newPoints = basePts.filter((_, i) => i !== index);
    dragPointsRef.current = null;
    setDragPoints(null);
    onUpdate(activeId, { points: newPoints });
  };

  const lastCornerClickRef = useRef({ time: 0, index: -1 });

  const handleCornerPointerDown = (event, index) => {
    if (disabled) return;
    if (event.button !== 0) return;
    event.stopPropagation();

    const now = performance.now();
    const isDoubleClick = (
      lastCornerClickRef.current.index === index &&
      (now - lastCornerClickRef.current.time) < 400
    );

    if (isDoubleClick) {
      lastCornerClickRef.current = { time: 0, index: -1 };
      removeVertexAtIndex(index);
      return;
    }

    lastCornerClickRef.current = { time: now, index };
    startGesture(event, index);
  };

  const activeCentroid = useMemo(() => {
    if (!activePoints?.length) return null;
    const pts = activePoints;
    const cx = pts.reduce((acc, p) => acc + p[0], 0) / pts.length;
    const cy = pts.reduce((acc, p) => acc + p[1], 0) / pts.length;
    return { x: cx * sourceWidth, y: cy * sourceHeight };
  }, [activePoints, sourceHeight]);

  const startGesture = useCallback((event, pointIndex, isPolygonMove = false) => {
    if (disabled || event.button !== 0) return;
    const point = toSourcePoint(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    svgRef.current?.setPointerCapture(event.pointerId);

    if (isPolygonMove && activeCandidate) {
      gesture.current = {
        type: "polygon",
        candidateId: activeId,
        startPoint: point,
        initialPoints: activeCandidate.points.map((p) => [...p]),
      };
    } else if (pointIndex !== undefined && activeCandidate) {
      gesture.current = {
        type: "vertex",
        candidateId: activeId,
        pointIndex,
        initialPoints: activeCandidate.points.map((p) => [...p]),
      };
    } else {
      gesture.current = {
        type: "pan",
        point,
      };
    }
  }, [activeCandidate, activeId, disabled, toSourcePoint]);

  const moveGesture = (event) => {
    if (!gesture.current || disabled) return;
    const point = toSourcePoint(event);
    if (!point) return;

    if (gesture.current.type === "vertex") {
      const basePoints = gesture.current.initialPoints;
      if (basePoints) {
        const nextPoints = basePoints.map((pt, index) =>
          index === gesture.current.pointIndex
            ? [clamp(point.x / sourceWidth, 0, 1), clamp(point.y / sourceHeight, 0, 1)]
            : pt
        );
        dragPointsRef.current = nextPoints;
        setDragPoints(nextPoints);
      }
      return;
    }

    if (gesture.current.type === "polygon") {
      const deltaX = (point.x - gesture.current.startPoint.x) / sourceWidth;
      const deltaY = (point.y - gesture.current.startPoint.y) / sourceHeight;
      const nextPoints = gesture.current.initialPoints.map(([x, y]) => [
        clamp(x + deltaX, 0, 1),
        clamp(y + deltaY, 0, 1),
      ]);
      dragPointsRef.current = nextPoints;
      setDragPoints(nextPoints);
      return;
    }

    const deltaX = point.x - gesture.current.point.x;
    const deltaY = point.y - gesture.current.point.y;
    setCenter({ x: clamp(viewCenter.x - deltaX, 0, sourceWidth), y: clamp(viewCenter.y - deltaY, 0, sourceHeight) });
  };

  const moveVertexWithKey = (event, index) => {
    if (!activeCandidate || disabled) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeVertexAtIndex(index);
      return;
    }
    const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = (event.shiftKey ? 0.01 : 0.002) / zoom;
    const [x, y] = activeCandidate.points[index];
    updateVertex(activeId, index, x + direction[0] * step, y + direction[1] * step);
  };

  const stopGesture = () => {
    if (gesture.current && dragPointsRef.current) {
      onUpdate(gesture.current.candidateId || activeId, { points: dragPointsRef.current });
    }
    gesture.current = null;
    dragPointsRef.current = null;
    setDragPoints(null);
  };
  const resetView = () => { setZoom(1); setCenter(null); };

  const inactivePolygonsLayer = useMemo(() => {
    return candidates.map((candidate, index) => {
      if (!candidate.points?.length || candidate.id === activeId) return null;
      const isNonSaleable = Boolean(candidate.nonSaleable);
      const style = isNonSaleable ? CATEGORY_STYLES.non_saleable : CATEGORY_STYLES.residential;
      const fill = candidate.selected
        ? style.fillSelected
        : isNonSaleable
        ? style.fillUnselected
        : "#064e3b";
      const fillOpacity = candidate.selected ? 0.35 : isNonSaleable ? 0.25 : 0.12;
      const stroke = candidate.selected
        ? style.strokeSelected
        : isNonSaleable
        ? style.strokeUnselected
        : "#10b981";
      const strokeWidth = isNonSaleable ? 2 : 1.5;
      const strokeDasharray = candidate.selected ? undefined : isNonSaleable ? "5 3" : undefined;
      const points = candidate.points.map(([x, y]) => [x * sourceWidth, y * sourceHeight]);
      const centroid = points.reduce(([x, y], point) => [x + point[0] / points.length, y + point[1] / points.length], [0, 0]);
      return (
        <g key={candidate.id}>
          <polygon
            points={points.map((point) => point.join(",")).join(" ")}
            fill={fill}
            fillOpacity={fillOpacity}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
            strokeDasharray={strokeDasharray}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label={`Show candidate ${index + 1}`}
            className="cursor-pointer outline-none focus:outline-none"
            style={{ outline: "none" }}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (!disabled) onActivate(candidate.id);
            }}
            onKeyDown={(event) => {
              if (!disabled && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                onActivate(candidate.id);
              }
            }}
          />
          <text
            x={centroid[0]}
            y={centroid[1]}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={clamp(10 / zoom, 1.5, 10)}
            fill="#0f172a"
            stroke="#f8fafc"
            strokeWidth={2 / zoom}
            paintOrder="stroke"
            fontWeight="700"
            pointerEvents="none"
          >
            {index + 1}
          </text>
        </g>
      );
    });
  }, [activeId, candidates, disabled, onActivate, zoom, sourceHeight]);

  const activePolygonElement = useMemo(() => {
    if (!activeCandidate || !activePoints?.length) return null;
    const activeIndex = candidates.findIndex((c) => c.id === activeId);
    const isNonSaleable = Boolean(activeCandidate.nonSaleable);
    const style = isNonSaleable ? CATEGORY_STYLES.non_saleable : CATEGORY_STYLES.residential;
    const fill = isNonSaleable ? style.strokeSelected : "#059669";
    const stroke = activeCandidate.selected ? style.strokeSelected : style.strokeUnselected;

    const pointsString = activePoints
      .map(([x, y]) => `${x * sourceWidth},${y * sourceHeight}`)
      .join(" ");

    const centroid = activePoints.reduce(
      (acc, [x, y]) => [acc[0] + (x * sourceWidth) / activePoints.length, acc[1] + (y * sourceHeight) / activePoints.length],
      [0, 0]
    );

    return (
      <g key={`active-${activeCandidate.id}`}>
        <polygon
          points={pointsString}
          fill={fill}
          fillOpacity={isEditingShape ? 0.45 : 0.55}
          stroke={stroke}
          strokeWidth={2.5 / zoom}
          strokeLinejoin="round"
          role={isEditingShape ? undefined : "button"}
          aria-label={isEditingShape ? undefined : `Show candidate ${activeIndex + 1}`}
          aria-pressed={isEditingShape ? undefined : "true"}
          style={{ cursor: disabled ? "default" : isEditingShape ? "move" : "pointer" }}
          onPointerDown={(event) => {
            if (isEditingShape) {
              startGesture(event, undefined, true);
            }
          }}
        />

        {!isEditingShape && (
          <text
            x={centroid[0]}
            y={centroid[1]}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={clamp(11 / zoom, 2, 12)}
            fill="#ffffff"
            stroke="#064e3b"
            strokeWidth={2.5 / zoom}
            paintOrder="stroke"
            fontWeight="800"
            pointerEvents="none"
          >
            {activeIndex + 1}
          </text>
        )}
      </g>
    );
  }, [activeCandidate, activeId, activePoints, candidates, disabled, isEditingShape, zoom, sourceHeight, startGesture]);

  return (
    <div className="relative flex h-full min-h-80 min-w-0 flex-col bg-[#1e293b]">
      {/* Toolbar */}
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-400">Source Plan</span>
          <span className="text-[10px] font-mono text-slate-500">{Math.round(zoom * 100)}%</span>
        </div>
        <div className="flex items-center gap-1">
          {onRescan && (
            <button
              type="button"
              disabled={disabled || isRescanning}
              onClick={onRescan}
              className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
              title="Deep re-scan blueprint with higher dashed-line tolerance"
            >
              {isRescanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              <span>{isRescanning ? "Scanning…" : "Deep Rescan"}</span>
            </button>
          )}

          {onAddManualCandidate && (
            <button
              type="button"
              disabled={disabled}
              onClick={onAddManualCandidate}
              className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              title="Add a new manual lot boundary directly on the blueprint"
            >
              <Plus className="h-3 w-3" />
              <span>Add lot</span>
            </button>
          )}

          {activeCandidate && onToggleEditShape && (
            <div className={`flex items-center gap-1 rounded-md transition ${
              isEditingShape ? "bg-emerald-500/10 p-0.5 border border-emerald-500/20" : ""
            }`}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onToggleEditShape(!isEditingShape)}
                className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium transition ${
                  isEditingShape
                    ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
                title={isEditingShape ? "Finish editing and lock lot shape" : "Edit corner points and move this lot"}
              >
                {isEditingShape ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span>Done</span>
                  </>
                ) : (
                  <>
                    <Pencil className="h-3 w-3" />
                    <span>Edit shape</span>
                  </>
                )}
              </button>

              {isEditingShape && onResetBoundary && (
                <button
                  type="button"
                  disabled={disabled || !canResetBoundary}
                  onClick={onResetBoundary}
                  aria-label="Reset active boundary"
                  className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-slate-300 hover:bg-white/10 hover:text-white transition disabled:cursor-not-allowed disabled:opacity-30"
                  title="Reset active boundary back to its detected shape"
                >
                  <RotateCcw className="h-3 w-3 text-slate-400" />
                  <span>Reset boundary</span>
                </button>
              )}
            </div>
          )}

          <div className="h-3.5 w-px bg-white/10 mx-0.5" />

          {/* Zoom Controls */}
          <button
            type="button"
            aria-label="Zoom out of plan"
            disabled={disabled || zoom <= 1}
            onClick={() => setZoom((value) => Math.max(1, value / 1.5))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-white/5 hover:text-slate-300 disabled:opacity-30 transition"
          >
            <Minus className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="Zoom into plan"
            disabled={disabled || zoom >= 24}
            onClick={() => setZoom((value) => Math.min(24, value * 1.5))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-white/5 hover:text-slate-300 disabled:opacity-30 transition"
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={resetView}
            className="h-7 rounded-md px-2 text-[11px] font-medium text-slate-500 hover:bg-white/5 hover:text-slate-300 disabled:opacity-30 transition"
          >
            Fit
          </button>

          {onToggleExpand && (
            <>
              <div className="h-3.5 w-px bg-white/10 mx-0.5" />
              <button
                type="button"
                disabled={disabled}
                onClick={onToggleExpand}
                className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium text-slate-500 hover:bg-white/5 hover:text-slate-300 disabled:opacity-30 transition"
                title={isExpanded ? "Restore side-by-side view" : "Expand map to full width"}
              >
                {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                <span>{isExpanded ? "Split" : "Expand"}</span>
              </button>
            </>
          )}
        </div>
      </div>
      {/* Legend bar */}
      <div className="flex items-center gap-4 border-b border-white/[0.04] px-4 py-1.5 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Saleable
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-500" />
          Non-Saleable
        </span>
        {isEditingShape ? (
          <span className="text-emerald-400/70 ml-1">
            Edit mode — drag corners · double-click to delete · click + to add
          </span>
        ) : (
          <span className="text-slate-600 ml-1">Click Edit shape to adjust · drag to pan</span>
        )}
      </div>

      <svg ref={svgRef} viewBox={`${viewCenter.x - viewWidth / 2} ${viewCenter.y - viewHeight / 2} ${viewWidth} ${viewHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full flex-1 touch-none bg-white" style={{ minHeight: isExpanded ? "36rem" : "26rem", cursor: disabled ? "default" : isEditingShape ? "default" : "grab" }}
        aria-label="Detected lot boundaries on source plan" role="group"
        onPointerDown={(event) => startGesture(event)} onPointerMove={moveGesture}
        onPointerUp={stopGesture} onPointerCancel={stopGesture} onLostPointerCapture={stopGesture}>
        <rect x="0" y="0" width={sourceWidth} height={sourceHeight} fill="#ffffff" />
        {imageUrl && <image href={imageUrl} x="0" y="0" width={sourceWidth} height={sourceHeight} preserveAspectRatio="none" pointerEvents="none" />}
        
        {/* Memoized background candidate polygons (zero re-render during drag) */}
        {inactivePolygonsLayer}

        {/* Active Candidate Polygon */}
        {activePolygonElement}

        {/* Midpoint '+' handles to add new corners between edges (Only in Edit Mode) */}
        {isEditingShape && midpointHandles.map((mid, idx) => (
          <g key={`mid-${idx}-${activeCandidate?.points?.length}`}>
            <circle
              cx={mid.x * sourceWidth}
              cy={mid.y * sourceHeight}
              r={16 / renderScale}
              fill="transparent"
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={`Add corner point between corner ${idx + 1} and ${(idx + 1) % (activeCandidate?.points?.length || 1) + 1}`}
              className="outline-none focus:outline-none cursor-pointer"
              style={{ cursor: disabled ? "default" : "pointer" }}
              onPointerDown={(event) => {
                event.stopPropagation();
                if (!disabled) addVertexAtIndex(mid.insertIndex, mid.x, mid.y);
              }}
              onKeyDown={(event) => {
                if (!disabled && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  addVertexAtIndex(mid.insertIndex, mid.x, mid.y);
                }
              }}
            >
              <title>Click to add new corner point</title>
            </circle>
            <circle
              cx={mid.x * sourceWidth}
              cy={mid.y * sourceHeight}
              r={7 / renderScale}
              pointerEvents="none"
              fill="#10b981"
              stroke="#ffffff"
              strokeWidth={1.5 / renderScale}
            />
            <text
              x={mid.x * sourceWidth}
              y={mid.y * sourceHeight}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={9 / renderScale}
              fill="#ffffff"
              fontWeight="900"
              pointerEvents="none"
            >
              +
            </text>
          </g>
        ))}

        {/* Center Move / Grab handle badge (Only in Edit Mode) */}
        {isEditingShape && activeCentroid && (
          <g key="active-centroid-move">
            <circle
              cx={activeCentroid.x}
              cy={activeCentroid.y}
              r={20 / renderScale}
              fill="transparent"
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label="Drag to move entire lot"
              className="outline-none focus:outline-none"
              style={{ cursor: disabled ? "default" : "grab" }}
              onPointerDown={(event) => {
                event.stopPropagation();
                if (!disabled) startGesture(event, undefined, true);
              }}
            >
              <title>Drag to move entire lot</title>
            </circle>
            <circle
              cx={activeCentroid.x}
              cy={activeCentroid.y}
              r={11 / renderScale}
              pointerEvents="none"
              fill="#8b5cf6"
              stroke="#ffffff"
              strokeWidth={1.8 / renderScale}
            />
            <g
              transform={`translate(${activeCentroid.x}, ${activeCentroid.y}) scale(${1 / renderScale})`}
              pointerEvents="none"
            >
              <path
                d="M 0 -4.5 L -2.5 -2 L -0.8 -2 L -0.8 -0.8 L -2 -0.8 L -2 -2.5 L -4.5 0 L -2 2.5 L -2 0.8 L -0.8 0.8 L -0.8 2 L -2.5 2 L 0 4.5 L 2.5 2 L 0.8 2 L 0.8 0.8 L 2 0.8 L 2 2.5 L 4.5 0 L 2 -2.5 L 2 -0.8 L 0.8 -0.8 L 0.8 -2 L 2.5 -2 Z"
                fill="#ffffff"
              />
            </g>
          </g>
        )}

        {/* Numbered Corner Handles with Drag & Double-Click to Delete (Only in Edit Mode) */}
        {isEditingShape && activePoints?.map(([x, y], index) => (
          <g key={`corner-${index}`}>
            <circle
              cx={x * sourceWidth}
              cy={y * sourceHeight}
              r={22 / renderScale}
              fill="transparent"
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={`Move corner ${index + 1} of active boundary with arrow keys`}
              className="outline-none focus:outline-none"
              style={{ cursor: disabled ? "default" : "move", outline: "none" }}
              onPointerDown={(event) => handleCornerPointerDown(event, index)}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                removeVertexAtIndex(index);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                removeVertexAtIndex(index);
              }}
              onKeyDown={(event) => moveVertexWithKey(event, index)}
            >
              <title>{`Corner ${index + 1} - Drag to move · Double-click / Right-click to delete`}</title>
            </circle>

            {/* Outer halo ring */}
            <circle
              cx={x * sourceWidth}
              cy={y * sourceHeight}
              r={12 / renderScale}
              pointerEvents="none"
              fill="rgba(16, 185, 129, 0.25)"
              stroke="#10b981"
              strokeWidth={1.2 / renderScale}
            />

            {/* Inner colored circle */}
            <circle
              cx={x * sourceWidth}
              cy={y * sourceHeight}
              r={8 / renderScale}
              pointerEvents="none"
              fill="#047857"
              stroke="#ffffff"
              strokeWidth={1.5 / renderScale}
            />

            {/* Corner number */}
            <text
              x={x * sourceWidth}
              y={y * sourceHeight}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={7.5 / renderScale}
              fill="#ffffff"
              fontWeight="700"
              pointerEvents="none"
            >
              {index + 1}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
