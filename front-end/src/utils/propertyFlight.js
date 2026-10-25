import { latLng, point } from "leaflet";

// Continuous velocity and acceleration, including takeoff and landing.
function ease(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Phased easing: delays x/y movement so zoom leads.
// `delay` controls how much position lags behind zoom (0 = no lag, 0.15 = default).
// At t=0..delay → position barely moves (camera rises straight up).
// At t=delay..1-delay → most horizontal travel happens (pan at cruise altitude).
// At t=1-delay..1.0 → position settles (camera drops straight down).
function positionEase(t, delay = 0.15) {
  // Remap t into [0,1] with compressed start/end plateaus.
  const span = Math.max(0.4, 1 - 2 * delay);
  const stretched = Math.max(0, Math.min(1, (t - delay) / span));
  return ease(stretched);
}

// Leaflet 1.9 fly/pinch lifecycle: transform existing layers during motion and
// reproject once at the end. A retarget never ends/restarts that lifecycle.
export function createPropertyFlight(map, onInterrupt) {
  const projectionZoom = 19;
  let frame = null, trajectory = null, ownMove = false;
  let lastTime = 0, elapsed = 0;
  // Throttle: skip navigate calls that arrive within 60ms of the last one.
  let lastNavigateTime = 0;
  let pendingNavigate = null, pendingTimer = null;

  const move = (center, zoom, final = false) => {
    ownMove = true;
    try {
      const sameZoom = map.getZoom() === zoom;
      // Leaflet otherwise skips layer transforms during a constant-zoom pan.
      map._move(center, zoom, final ? undefined : (sameZoom ? { flyTo: true, pinch: true } : { flyTo: true }));
      // Commit the exact landing once, with the normal tile/layer refresh.
      if (final && sameZoom) map.fire("zoom");
    }
    finally { ownMove = false; }
  };
  const cancel = (center, zoom) => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    if (pendingTimer !== null) { clearTimeout(pendingTimer); pendingTimer = null; }
    pendingNavigate = null;
    if (!trajectory) return;
    trajectory = null;
    if (!map._mapPane) return;
    move(center || map.getCenter(), zoom ?? map.getZoom(), true);
    ownMove = true;
    try { map._moveEnd(true); } finally { ownMove = false; }
  };
  const getTime = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
  const step = (time) => {
    frame = null;
    if (!trajectory) return;
    // Cap frame delta at 40ms to prevent teleporting after stalls.
    // Use the display-frame timestamp instead of when this callback got CPU time.
    elapsed += Math.max(0, Math.min(40, time - lastTime));
    lastTime = Math.max(lastTime, time);
    const { from, to, duration, arc, destination, straight, phaseDelay } = trajectory;
    const t = Math.min(1, elapsed / duration);
    if (straight) {
      const e = ease(t);
      const zoomDelta = to.zoom - from.zoom;
      // True visual straight-line tracking: corrects for exponential WebMercator zoom scaling
      // so the clicked target moves in a 100% straight screen path directly into the center without curving.
      const u = zoomDelta > 0
        ? 1 - (1 - e) * Math.pow(2, -zoomDelta * e)
        : e;
      const px = from.x + (to.x - from.x) * u;
      const py = from.y + (to.y - from.y) * u;
      const finalZoom = from.zoom + zoomDelta * e;
      if (t === 1) {
        cancel(destination, to.zoom);
      } else {
        move(map.unproject(point(px, py), projectionZoom), finalZoom);
        if (trajectory && frame === null) frame = requestAnimationFrame(step);
      }
      return;
    }
    // Phase the animation: zoom leads, position follows with a delay (rise then move then land).
    const pe = positionEase(t, phaseDelay);
    const ze = ease(t);
    const px = from.x + (to.x - from.x) * pe;
    const py = from.y + (to.y - from.y) * pe;
    const baseZoom = from.zoom + (to.zoom - from.zoom) * ze;
    // Same smooth rounded dome arc across all flights:
    const zoomArc = arc * 64 * t * t * t * (1 - t) ** 3;
    const finalZoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), baseZoom - zoomArc));
    if (t === 1) {
      cancel(destination, to.zoom);
    } else {
      move(map.unproject(point(px, py), projectionZoom), finalZoom);
      if (trajectory && frame === null) frame = requestAnimationFrame(step);
    }
  };
  const executeNavigate = (coordinates, zoom, duration, options = {}) => {
    // Do not let a delayed older retarget interrupt the latest destination.
    if (pendingTimer !== null) clearTimeout(pendingTimer);
    pendingTimer = null;
    pendingNavigate = null;
    if (!trajectory) {
      if (map._animatingZoom) map._onZoomTransitionEnd();
      map._stop();
    }
    const from = map.project(map.getCenter(), projectionZoom);
    const to = map.project(coordinates, projectionZoom);
    const startZoom = map.getZoom();
    const viewport = Math.max(1, Math.max(map.getSize().x, map.getSize().y));
    const screenDistanceAt19 = from.distanceTo(to);
    const screensAwayAt19 = screenDistanceAt19 / viewport;

    // True Geodesic Altitude Calculation:
    const wasActive = !!trajectory;
    // Scale flight altitude according to physical distance so large inter-province
    // journeys (e.g. Iloilo -> Boracay ~180km) pull all the way back to island overview
    // (Zoom 9-10), while local switches (<15km) stay at comfortable town level (Zoom 13-14).
    const idealOverviewZoom = projectionZoom - Math.log2(Math.max(1, screensAwayAt19 * 1.25));
    // For very close local hops (<1km), provide a gentle, polished 3D pop arc (0.5 to 1.2 levels):
    const localLift = Math.min(1.2, 0.4 + Math.min(1, screensAwayAt19) * 0.8);
    const minTripZoom = Math.min(startZoom, zoom);
    // When switching properties (especially mid-flight retargeting), ensure a satisfying bounce arc:
    const bounceLift = wasActive ? 0.8 : (screensAwayAt19 < 2 ? localLift : 0.4);
    // Cruise altitude: never dive into space if already in wide overview,
    // and rises to idealOverviewZoom on long cross-island flights:
    const cruiseZoom = Math.max(map.getMinZoom(), Math.min(minTripZoom - bounceLift, idealOverviewZoom));
    const phaseDelay = 0.30;
    const destLatLng = latLng(coordinates);
    const isStraight = Boolean(options.straight);
    trajectory = {
      from: { x: from.x, y: from.y, zoom: startZoom },
      to: { x: to.x, y: to.y, zoom },
      duration: duration * 1000, destination: destLatLng,
      arc: isStraight ? 0 : Math.max(0, (startZoom + zoom) / 2 - cruiseZoom),
      straight: isStraight,
      phaseDelay,
    };
    elapsed = 0;
    lastTime = getTime();
    lastNavigateTime = lastTime;
    if (!wasActive) {
      ownMove = true;
      try { map._moveStart(true); } finally { ownMove = false; }
    }
    if (frame === null) frame = requestAnimationFrame(step);
  };
  const navigate = (coordinates, zoom, options = {}) => {
    const duration = options.duration ?? 2;
    const now = getTime();
    const sinceLast = now - lastNavigateTime;
    // If rapid-fire calls arrive within 60ms, batch them: only execute the latest.
    if (sinceLast < 60 && trajectory) {
      pendingNavigate = { coordinates, zoom, duration, options };
      if (pendingTimer === null) {
        pendingTimer = setTimeout(() => {
          pendingTimer = null;
          const pending = pendingNavigate;
          pendingNavigate = null;
          if (pending) executeNavigate(pending.coordinates, pending.zoom, pending.duration, pending.options);
        }, 60 - sinceLast);
      }
      return;
    }
    executeNavigate(coordinates, zoom, duration, options);
  };
  const onExternalMove = () => {
    if (!ownMove && trajectory) { cancel(); onInterrupt?.(); }
  };
  map.on("movestart zoomstart", onExternalMove);
  return {
    navigate, cancel,
    dispose: () => { map.off("movestart zoomstart", onExternalMove); cancel(); },
  };
}
