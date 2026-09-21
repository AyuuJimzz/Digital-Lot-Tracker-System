// Leaflet 1.9's pinch/fly lifecycle transforms existing vector/tile layers per
// frame and projects paths only at gesture end. Keep the version-specific calls
// here; never scale/reset mapPane independently of Leaflet's camera state.
export function attachSmoothWheelZoom(map) {
  const container = map.getContainer();
  const nativeWheelEnabled = map.scrollWheelZoom.enabled();
  map.scrollWheelZoom.disable();
  let active = false, frame = null, ownMove = false;
  let targetZoom, anchor, offset, lastTime, lastInput;

  const move = (zoom, final = false) => {
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
    container.classList.remove("map-wheel-zooming");
    // Commit the currently displayed view, never jump to an unrendered target.
    move(map.getZoom(), true);
    ownMove = true;
    try { map._moveEnd(true); } finally { ownMove = false; }
  };

  const step = (time) => {
    frame = null;
    if (!active) return;
    const elapsed = Math.min(64, Math.max(1, time - lastTime));
    lastTime = time;
    const difference = targetZoom - map.getZoom();
    const nextZoom = Math.abs(difference) < 0.001
      ? targetZoom
      : map.getZoom() + difference * (1 - Math.exp(-elapsed / 75));
    move(nextZoom);
    if (Math.abs(targetZoom - nextZoom) < 0.001 && time - lastInput >= 100) {
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
    if (!active) {
      if (map._animatingZoom) map._onZoomTransitionEnd();
      map._stop();
      targetZoom = map.getZoom();
      active = true;
      lastTime = performance.now();
      container.classList.add("map-wheel-zooming");
      ownMove = true;
      try { map._moveStart(true); } finally { ownMove = false; }
    }
    lastInput = performance.now();
    const point = map.mouseEventToContainerPoint(event);
    anchor = map.containerPointToLatLng(point);
    offset = point.subtract(map.getSize().divideBy(2));
    targetZoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(),
      targetZoom - Math.max(-120, Math.min(120, delta)) / 300));
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
