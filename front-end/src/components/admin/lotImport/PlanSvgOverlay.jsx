import React, { useMemo } from "react";
import { clamp, sourceWidth, CATEGORY_STYLES } from "./planStyles";

export default function PlanSvgOverlay({
  candidates,
  activeId,
  activeCandidate,
  activePoints,
  disabled,
  isEditingShape,
  onActivate,
  sourceHeight,
  zoom,
  renderScale,
  startGesture,
  midpointHandles,
  addVertexAtIndex,
  activeCentroid,
  handleCornerPointerDown,
  removeVertexAtIndex,
  moveVertexWithKey,
}) {
  // Memoized background candidate polygons (zero re-render during drag)
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

  // Active candidate polygon
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
    <>
      {/* Background candidate polygons */}
      {inactivePolygonsLayer}

      {/* Active candidate polygon */}
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
    </>
  );
}
