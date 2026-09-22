// Leaflet 1.9's pinch/fly lifecycle transforms existing vector/tile layers per
// frame and projects paths only at gesture end. Keep the version-specific calls
// here; never scale/reset mapPane independently of Leaflet's camera state.
export function attachSmoothWheelZoom(map) {
  const container = map.getContainer();
  const nativeWheelEnabled = map.scrollWheelZoom.enabled();
  map.scrollWheelZoom.disable();
  let active = false, frame = null, ownMove = false;
  let targetZoom, anchor, offset, lastTime, lastInput;
  let lastPoint = null;
  let currentTau = 58;

  const move = (zoom, final = false) => {
    if (!anchor || !offset) return;
    const center = map.unproject(map.project(anchor, zoom).subtract(offset), zoom);
    ownMove = true;
    try {
      map._move(center, zoom, final ? undefined : { pinch: true, round: false });
    } finally {
      ownMove = false;
    }
  };

  const finish = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    if (!active) return;
    active = false;
    lastPoint = null;
    container.classList.remove("map-wheel-zooming");
    // Commit the currently displayed view, never jump to an unrendered target.
    move(map.getZoom(), true);
    ownMove = true;
    try { map._moveEnd(true); } finally { ownMove = false; }
  };

  const step = (time) => {
    frame = null;
    if (!active) return;
    const elapsed = Math.min(40, Math.max(1, time - lastTime));
    lastTime = time;
    const difference = targetZoom - map.getZoom();
    const nextZoom = Math.abs(difference) < 0.001
      ? targetZoom
      : map.getZoom() + difference * (1 - Math.exp(-elapsed / currentTau));
    move(nextZoom);
    if (Math.abs(targetZoom - nextZoom) < 0.001 && time - lastInput >= 80) {
      move(targetZoom);
      finish();
    } else {
      frame = requestAnimationFrame(step);
    }
  };

  const onWheel = (event) => {
    if (event.target?.closest?.("input, textarea, select, [contenteditable=true], .leaflet-control")) return;
    let delta = event.deltaY;
    if (event.deltaMode === 1) delta *= 16;
    if (event.deltaMode === 2) delta *= map.getSize().y;
    if (!Number.isFinite(delta) || delta === 0) return;
    event.preventDefault();
    event.stopPropagation();

    const now = performance.now();
    if (!active) {
      if (map._animatingZoom) map._onZoomTransitionEnd();
      map._stop();
      targetZoom = map.getZoom();
      active = true;
      lastTime = now;
      lastPoint = null;
      container.classList.add("map-wheel-zooming");
      ownMove = true;
      try { map._moveStart(true); } finally { ownMove = false; }
    }
    lastInput = now;

    // Zero-drift Spatial Anchor: Lock the exact geographical coordinate under the cursor
    // so the spot under the mouse stays completely motionless while zooming.
    // Only re-anchor if the user physically moves the cursor across the screen.
    const point = map.mouseEventToContainerPoint(event);
    if (!anchor || !offset || !lastPoint || point.distanceTo(lastPoint) > 3) {
      anchor = map.containerPointToLatLng(point);
      offset = point.subtract(map.getSize().divideBy(2));
      lastPoint = point;
    }

    // Adaptive Input Classification:
    // 1. Touchpad Pinch (event.ctrlKey) -> High-fidelity direct 1:1 gesture response
    // 2. Discrete Mouse Wheel (notched wheel) -> Crisp, controlled step with silky deceleration
    // 3. Touchpad Continuous Swipe -> Natural, low-latency follow-through without rubber-banding
    const isPinch = Boolean(event.ctrlKey);
    const isDiscreteWheel = event.deltaMode === 1 || (Math.abs(delta) >= 50 && Number.isInteger(delta));
    let zoomDelta;

    if (isPinch) {
      zoomDelta = -Math.max(-0.7, Math.min(0.7, delta * 0.018));
      currentTau = 28; // Ultra-responsive follow-through for fingers
    } else if (isDiscreteWheel) {
      zoomDelta = -Math.sign(delta) * Math.min(0.38, Math.abs(delta) / 280);
      currentTau = 58; // Creamy luxury glide between wheel notches
    } else {
      zoomDelta = -Math.max(-0.45, Math.min(0.45, delta / 160));
      currentTau = 36; // Tactile response for two-finger touchpad swipes
    }

    targetZoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), targetZoom + zoomDelta));
    if (frame === null) frame = requestAnimationFrame(step);
  };

  const onExternalMove = () => { if (!ownMove) finish(); };
  container.addEventListener("wheel", onWheel, { passive: false });
  container.addEventListener("pointerdown", finish);
  container.addEventListener("touchstart", finish, { passive: true });
  map.on("propertyflightstart movestart zoomstart", onExternalMove);

  return () => {
    container.removeEventListener("wheel", onWheel);
    container.removeEventListener("pointerdown", finish);
    container.removeEventListener("touchstart", finish);
    map.off("propertyflightstart movestart zoomstart", onExternalMove);
    if (map._mapPane) finish();
    else if (frame !== null) cancelAnimationFrame(frame);
    container.classList.remove("map-wheel-zooming");
    if (nativeWheelEnabled) map.scrollWheelZoom.enable();
  };
}
