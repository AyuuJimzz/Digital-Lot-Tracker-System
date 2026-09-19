import { useEffect, useRef } from "react";
import L from "leaflet";

/**
 * Custom hook for hybrid progressive smooth mouse-wheel zooming on a Leaflet map.
 * 
 * Architecture:
 * - RAF Visual Interpolation: Uses requestAnimationFrame to smoothly scale the master mapPane
 *   (tiles + polygons + markers) toward targetZoom for Google Maps-like fluidity.
 * - Throttled Progressive Commits: While the user is scrolling, periodically commits the current
 *   visual zoom to Leaflet (every ~120ms or whenever accumulated visual delta reaches ~0.25 zoom levels)
 *   with animate:false, immediately rebasing the visual transform.
 * - Result: Satellite tiles continuously refresh and remain crisp during zoom; zero frozen-image feeling;
 *   zero 60fps tile storms; zero polygon wobble.
 *
 * @param {L.Map|null} map - Leaflet map instance
 * @param {Object} [options]
 * @param {number} [options.sensitivity=0.0018] - Wheel zoom sensitivity multiplier
 * @param {number} [options.easing=0.20] - Easing factor per animation frame (0 to 1)
 * @param {number} [options.epsilon=0.001] - Finish threshold for zoom difference
 * @param {number} [options.maxStepDelta=120] - Maximum clamped wheel delta per tick
 * @param {number} [options.progressiveThrottleMs=120] - Progressive commit throttle interval
 * @param {number} [options.maxVisualDelta=0.25] - Maximum visual zoom difference before progressive commit
 * @param {number} [options.settleDebounceMs=40] - Settle delay before final real zoom commit
 */
export function useSmoothWheelZoom(map, options = {}) {
  const {
    sensitivity = 0.0018,
    easing = 0.20,
    epsilon = 0.001,
    maxStepDelta = 120,
    progressiveThrottleMs = 120,
    maxVisualDelta = 0.25,
    settleDebounceMs = 40,
  } = options;

  const isZoomingRef = useRef(false);
  const committedZoomRef = useRef(null);
  const targetZoomRef = useRef(null);
  const visualZoomRef = useRef(null);
  const panePosRef = useRef({ x: 0, y: 0 });
  const lastCommitTimeRef = useRef(0);

  const rafIdRef = useRef(null);
  const settleTimerRef = useRef(null);
  const optionsRef = useRef({
    sensitivity,
    easing,
    epsilon,
    maxStepDelta,
    progressiveThrottleMs,
    maxVisualDelta,
    settleDebounceMs,
  });

  useEffect(() => {
    optionsRef.current = {
      sensitivity,
      easing,
      epsilon,
      maxStepDelta,
      progressiveThrottleMs,
      maxVisualDelta,
      settleDebounceMs,
    };
  }, [
    sensitivity,
    easing,
    epsilon,
    maxStepDelta,
    progressiveThrottleMs,
    maxVisualDelta,
    settleDebounceMs,
  ]);

  useEffect(() => {
    if (!map) return;

    let container;
    try {
      container = map.getContainer();
    } catch {
      return;
    }
    if (!container) return;

    const getMapPane = () => {
      try {
        return map.getPane("mapPane") || map._mapPane;
      } catch {
        return null;
      }
    };

    const applyVisualScale = (vZoom) => {
      const mapPane = getMapPane();
      if (!mapPane || committedZoomRef.current === null) return;

      const scale = typeof map.getZoomScale === "function"
        ? map.getZoomScale(vZoom, committedZoomRef.current)
        : Math.pow(2, vZoom - committedZoomRef.current);

      const pos = panePosRef.current || { x: 0, y: 0 };
      mapPane.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0px) scale(${scale})`;
    };

    const commitProgressive = (newCommittedZoom) => {
      const mapPane = getMapPane();
      if (!mapPane || !map) return;

      committedZoomRef.current = newCommittedZoom;
      lastCommitTimeRef.current = Date.now();

      // Commit real zoom to Leaflet (animate: false avoids SVG polygon warping)
      map.setZoom(newCommittedZoom, { animate: false });

      // Rebase mapPane transform origin and position from the newly committed zoom
      let pos = { x: 0, y: 0 };
      if (typeof map._getMapPanePos === "function") {
        pos = map._getMapPanePos();
      } else if (L?.DomUtil?.getPosition) {
        pos = L.DomUtil.getPosition(mapPane) || { x: 0, y: 0 };
      }
      panePosRef.current = { x: pos.x || 0, y: pos.y || 0 };

      const size = map.getSize();
      const originX = size.x / 2 - (pos.x || 0);
      const originY = size.y / 2 - (pos.y || 0);
      mapPane.style.transformOrigin = `${originX}px ${originY}px`;
      mapPane.style.willChange = "transform";

      // Apply rebased visual scale (scale = 1.0 at commit point)
      if (visualZoomRef.current !== null) {
        applyVisualScale(visualZoomRef.current);
      }
    };

    const finalSettle = () => {
      if (!map || !isZoomingRef.current) return;

      const finalZoom = targetZoomRef.current;
      isZoomingRef.current = false;
      committedZoomRef.current = null;
      targetZoomRef.current = null;
      visualZoomRef.current = null;

      const mapPane = getMapPane();
      if (mapPane) {
        mapPane.style.transformOrigin = "";
        mapPane.style.willChange = "";
        mapPane.style.transform = "";
      }

      if (finalZoom !== null && typeof finalZoom === "number") {
        map.setZoom(finalZoom, { animate: false });
      }
    };

    const handleWheel = (e) => {
      e.preventDefault();
      if (typeof e.stopPropagation === "function") {
        e.stopPropagation();
      }

      const {
        sensitivity: sens,
        easing: ease,
        epsilon: eps,
        maxStepDelta: maxDelta,
        progressiveThrottleMs: progThrottle,
        maxVisualDelta: maxVisDelta,
        settleDebounceMs: settleDelay,
      } = optionsRef.current;

      let delta = e.deltaY;
      if (e.deltaMode === 1) {
        delta *= 16;
      } else if (e.deltaMode === 2) {
        delta *= 100;
      }

      delta = Math.max(-maxDelta, Math.min(maxDelta, delta));

      const minZoom = typeof map.getMinZoom === "function" ? map.getMinZoom() : 1;
      const maxZoom = typeof map.getMaxZoom === "function" ? map.getMaxZoom() : 28;

      const currentMapZoom = map.getZoom();

      // Initialize zoom session if not currently active
      if (!isZoomingRef.current) {
        isZoomingRef.current = true;
        committedZoomRef.current = currentMapZoom;
        targetZoomRef.current = currentMapZoom;
        visualZoomRef.current = currentMapZoom;
        lastCommitTimeRef.current = Date.now();

        const mapPane = getMapPane();
        if (mapPane) {
          let pos = { x: 0, y: 0 };
          if (typeof map._getMapPanePos === "function") {
            pos = map._getMapPanePos();
          } else if (L?.DomUtil?.getPosition) {
            pos = L.DomUtil.getPosition(mapPane) || { x: 0, y: 0 };
          }
          panePosRef.current = { x: pos.x || 0, y: pos.y || 0 };

          const size = map.getSize();
          const originX = size.x / 2 - (pos.x || 0);
          const originY = size.y / 2 - (pos.y || 0);
          mapPane.style.transformOrigin = `${originX}px ${originY}px`;
          mapPane.style.willChange = "transform";
        }
      }

      // Update target zoom incrementally
      const zoomChange = -delta * sens;
      targetZoomRef.current = Math.max(
        minZoom,
        Math.min(maxZoom, targetZoomRef.current + zoomChange)
      );

      // Clear pending settle timer while active wheel ticks arrive
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }

      // Start or continue requestAnimationFrame visual loop
      if (!rafIdRef.current) {
        const step = () => {
          if (!map || !isZoomingRef.current) {
            rafIdRef.current = null;
            return;
          }

          const diff = targetZoomRef.current - visualZoomRef.current;

          // Reached final target zoom
          if (Math.abs(diff) <= eps) {
            visualZoomRef.current = targetZoomRef.current;
            applyVisualScale(visualZoomRef.current);
            rafIdRef.current = null;

            clearTimeout(settleTimerRef.current);
            settleTimerRef.current = setTimeout(finalSettle, settleDelay);
            return;
          }

          // Smooth visual interpolation toward target
          visualZoomRef.current += diff * ease;
          applyVisualScale(visualZoomRef.current);

          // Progressive Commit: check if visual delta or time elapsed warrants a real Leaflet zoom commit
          const now = Date.now();
          const visualDelta = Math.abs(visualZoomRef.current - (committedZoomRef.current || visualZoomRef.current));
          const timeSinceCommit = now - lastCommitTimeRef.current;

          if (visualDelta >= maxVisDelta || (timeSinceCommit >= progThrottle && visualDelta >= 0.05)) {
            commitProgressive(visualZoomRef.current);
          }

          rafIdRef.current = requestAnimationFrame(step);
        };

        rafIdRef.current = requestAnimationFrame(step);
      }
    };

    // If map drag starts while zooming, commit immediately to keep dragging responsive
    const handleDragStart = () => {
      if (isZoomingRef.current) {
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        if (settleTimerRef.current) {
          clearTimeout(settleTimerRef.current);
          settleTimerRef.current = null;
        }
        finalSettle();
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    map.on("dragstart", handleDragStart);
    map.on("movestart", handleDragStart);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      map.off("dragstart", handleDragStart);
      map.off("movestart", handleDragStart);

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }

      const mapPane = getMapPane();
      if (mapPane) {
        mapPane.style.transformOrigin = "";
        mapPane.style.willChange = "";
        mapPane.style.transform = "";
      }

      isZoomingRef.current = false;
      committedZoomRef.current = null;
      targetZoomRef.current = null;
      visualZoomRef.current = null;
    };
  }, [map]);
}

export default useSmoothWheelZoom;
