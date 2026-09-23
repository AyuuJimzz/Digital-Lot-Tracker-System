import { useCallback, useMemo, useRef, useState } from "react";
import { clamp, sourceWidth } from "./planStyles";

export const usePlanGesture = ({
  svgRef,
  activeCandidate,
  activeId,
  candidates,
  disabled,
  onUpdate,
  sourceHeight,
  viewCenter,
  setCenter,
  toSourcePoint,
  zoom,
}) => {
  const [dragPoints, setDragPoints] = useState(null);
  const dragPointsRef = useRef(null);
  const gesture = useRef(null);
  const lastCornerClickRef = useRef({ time: 0, index: -1 });

  const activePoints = dragPoints || activeCandidate?.points;

  const updateVertex = useCallback((candidateId, pointIndex, x, y) => {
    const candidate = candidates.find((item) => item.id === candidateId);
    if (!candidate || disabled) return;
    onUpdate(candidateId, {
      points: candidate.points.map((point, index) => index === pointIndex ? [clamp(x, 0, 1), clamp(y, 0, 1)] : point),
    });
  }, [candidates, disabled, onUpdate]);

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

  const addVertexAtIndex = useCallback((insertIndex, midX, midY) => {
    if (!activeCandidate || disabled) return;
    const newPoints = [...(dragPoints || activeCandidate.points)];
    newPoints.splice(insertIndex, 0, [clamp(midX, 0, 1), clamp(midY, 0, 1)]);
    onUpdate(activeId, { points: newPoints });
  }, [activeCandidate, activeId, disabled, dragPoints, onUpdate]);

  const removeVertexAtIndex = useCallback((index) => {
    if (!activeCandidate || disabled) return;
    const basePts = dragPointsRef.current || dragPoints || activeCandidate.points;
    if (basePts.length <= 3) return;
    const newPoints = basePts.filter((_, i) => i !== index);
    dragPointsRef.current = null;
    setDragPoints(null);
    onUpdate(activeId, { points: newPoints });
  }, [activeCandidate, activeId, disabled, dragPoints, onUpdate]);

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
  }, [activeCandidate, activeId, disabled, toSourcePoint, svgRef]);

  const handleCornerPointerDown = useCallback((event, index) => {
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
  }, [disabled, removeVertexAtIndex, startGesture]);

  const activeCentroid = useMemo(() => {
    if (!activePoints?.length) return null;
    const pts = activePoints;
    const cx = pts.reduce((acc, p) => acc + p[0], 0) / pts.length;
    const cy = pts.reduce((acc, p) => acc + p[1], 0) / pts.length;
    return { x: cx * sourceWidth, y: cy * sourceHeight };
  }, [activePoints, sourceHeight]);

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
    setCenter({
      x: clamp(viewCenter.x - deltaX, 0, sourceWidth),
      y: clamp(viewCenter.y - deltaY, 0, sourceHeight),
    });
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

  return {
    activePoints,
    dragPoints,
    midpointHandles,
    activeCentroid,
    startGesture,
    moveGesture,
    stopGesture,
    handleCornerPointerDown,
    addVertexAtIndex,
    removeVertexAtIndex,
    moveVertexWithKey,
  };
};

export default usePlanGesture;
