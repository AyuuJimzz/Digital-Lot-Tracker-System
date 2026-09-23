import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clamp, sourceWidth } from "./planStyles";

export const usePlanViewport = ({
  svgRef,
  pageWidth,
  pageHeight,
  imageUrl,
  initialViewport,
  onViewportChange,
  focusRequest,
  activeCandidate,
  disabled,
}) => {
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
    if (typeof ResizeObserver === "undefined" || !svgRef.current) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width && entry.contentRect.height) {
        setCanvasSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(svgRef.current);
    return () => observer.disconnect();
  }, [svgRef]);

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
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    setZoom(clamp(0.6 / Math.max(right - left, bottom - top, 0.025), 1, 24));
    setCenter({ x: ((left + right) * sourceWidth) / 2, y: ((top + bottom) * sourceHeight) / 2 });
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
  }, [canvasSize.width, canvasSize.height, viewCenter.x, viewCenter.y, viewWidth, viewHeight, svgRef]);

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
  }, [disabled, sourceHeight, toSourcePoint, viewCenter, svgRef]);

  const resetView = () => {
    setZoom(1);
    setCenter(null);
  };

  return {
    sourceHeight,
    zoom,
    setZoom,
    center,
    setCenter,
    canvasSize,
    viewWidth,
    viewHeight,
    renderScale,
    viewCenter,
    toSourcePoint,
    resetView,
  };
};

export default usePlanViewport;
