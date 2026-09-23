import React, { useRef } from "react";
import { sourceWidth } from "./planStyles";
import usePlanViewport from "./usePlanViewport";
import usePlanGesture from "./usePlanGesture";
import PlanToolbar from "./PlanToolbar";
import PlanSvgOverlay from "./PlanSvgOverlay";

export default function LotPlanPreview({
  candidates,
  activeId,
  focusRequest,
  imageUrl,
  pageWidth,
  pageHeight,
  onActivate,
  onUpdate,
  onDelete,
  onViewportChange,
  disabled,
  isExpanded = false,
  onToggleExpand,
  isEditingShape = false,
  onToggleEditShape,
  onAddManualCandidate,
  onRescan,
  isRescanning,
  onResetBoundary,
  canResetBoundary = false,
  initialViewport = null,
}) {
  const svgRef = useRef(null);
  const activeCandidate = candidates.find((candidate) => candidate.id === activeId);

  const viewport = usePlanViewport({
    svgRef,
    pageWidth,
    pageHeight,
    imageUrl,
    initialViewport,
    onViewportChange,
    focusRequest,
    activeCandidate,
    disabled,
  });

  const gesture = usePlanGesture({
    svgRef,
    activeCandidate,
    activeId,
    candidates,
    disabled,
    onUpdate,
    sourceHeight: viewport.sourceHeight,
    viewCenter: viewport.viewCenter,
    setCenter: viewport.setCenter,
    toSourcePoint: viewport.toSourcePoint,
    zoom: viewport.zoom,
  });

  const {
    sourceHeight,
    zoom,
    setZoom,
    viewWidth,
    viewHeight,
    renderScale,
    viewCenter,
    resetView,
  } = viewport;

  const {
    activePoints,
    midpointHandles,
    activeCentroid,
    startGesture,
    moveGesture,
    stopGesture,
    handleCornerPointerDown,
    addVertexAtIndex,
    removeVertexAtIndex,
    moveVertexWithKey,
  } = gesture;

  return (
    <div className="relative flex h-full min-h-80 min-w-0 flex-col bg-[#1e293b]">
      {/* Toolbar & Legend */}
      <PlanToolbar
        zoom={zoom}
        setZoom={setZoom}
        resetView={resetView}
        disabled={disabled}
        onRescan={onRescan}
        isRescanning={isRescanning}
        onAddManualCandidate={onAddManualCandidate}
        activeCandidate={activeCandidate}
        onToggleEditShape={onToggleEditShape}
        isEditingShape={isEditingShape}
        onResetBoundary={onResetBoundary}
        canResetBoundary={canResetBoundary}
        onToggleExpand={onToggleExpand}
        isExpanded={isExpanded}
      />

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        viewBox={`${viewCenter.x - viewWidth / 2} ${viewCenter.y - viewHeight / 2} ${viewWidth} ${viewHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full flex-1 touch-none bg-white"
        style={{
          minHeight: isExpanded ? "36rem" : "26rem",
          cursor: disabled ? "default" : isEditingShape ? "default" : "grab",
        }}
        aria-label="Detected lot boundaries on source plan"
        role="group"
        onPointerDown={(event) => startGesture(event)}
        onPointerMove={moveGesture}
        onPointerUp={stopGesture}
        onPointerCancel={stopGesture}
        onLostPointerCapture={stopGesture}
      >
        <rect x="0" y="0" width={sourceWidth} height={sourceHeight} fill="#ffffff" />
        {imageUrl && (
          <image
            href={imageUrl}
            x="0"
            y="0"
            width={sourceWidth}
            height={sourceHeight}
            preserveAspectRatio="none"
            pointerEvents="none"
          />
        )}

        {/* SVG Polygon Layers & Interactive Handles */}
        <PlanSvgOverlay
          candidates={candidates}
          activeId={activeId}
          activeCandidate={activeCandidate}
          activePoints={activePoints}
          disabled={disabled}
          isEditingShape={isEditingShape}
          onActivate={onActivate}
          sourceHeight={sourceHeight}
          zoom={zoom}
          renderScale={renderScale}
          startGesture={startGesture}
          midpointHandles={midpointHandles}
          addVertexAtIndex={addVertexAtIndex}
          activeCentroid={activeCentroid}
          handleCornerPointerDown={handleCornerPointerDown}
          removeVertexAtIndex={removeVertexAtIndex}
          moveVertexWithKey={moveVertexWithKey}
        />
      </svg>
    </div>
  );
}

export { CATEGORY_STYLES } from "./planStyles";
