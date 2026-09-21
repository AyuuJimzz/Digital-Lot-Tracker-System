import { latLng, point } from "leaflet";

// Cubic Hermite: retain the displayed camera's velocity when retargeting, then
// ease to zero velocity at arrival. Units are projected pixels / milliseconds.
function sample(from, to, velocity, duration, t) {
  const t2 = t * t, t3 = t2 * t;
  return {
    value: from + (to - from) * (3 * t2 - 2 * t3) + velocity * duration * (t3 - 2 * t2 + t),
    velocity: (to - from) * (6 * t - 6 * t2) / duration + velocity * (3 * t2 - 4 * t + 1),
  };
}

// Leaflet 1.9 fly/pinch lifecycle: transform existing layers during motion and
// reproject once at the end. A retarget never ends/restarts that lifecycle.
export function createPropertyFlight(map, onInterrupt) {
  const projectionZoom = 19;
  let frame = null, trajectory = null, ownMove = false;
  let velocity = { x: 0, y: 0, zoom: 0 };
  let lastTime = 0, elapsed = 0;

  const move = (center, zoom, final = false) => {
    ownMove = true;
    try { map._move(center, zoom, final ? undefined : { flyTo: true }); }
    finally { ownMove = false; }
  };
  const cancel = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    if (!trajectory) return;
    trajectory = null;
    velocity = { x: 0, y: 0, zoom: 0 };
    if (!map._mapPane) return;
    move(map.getCenter(), map.getZoom(), true);
    ownMove = true;
    try { map._moveEnd(true); } finally { ownMove = false; }
  };
  const step = (time) => {
    frame = null;
    if (!trajectory) return;
    // A busy frame must not teleport the camera forward by the entire stall.
    // Normal 60/120Hz timing is unchanged; a long stall extends the flight.
    elapsed += Math.max(0, Math.min(40, time - lastTime));
    lastTime = time;
    const { from, to, initialVelocity, duration, arc, destination } = trajectory;
    const t = Math.min(1, elapsed / duration);
    const x = sample(from.x, to.x, initialVelocity.x, duration, t);
    const y = sample(from.y, to.y, initialVelocity.y, duration, t);
    const zoom = sample(from.zoom, to.zoom, initialVelocity.zoom, duration, t);
    // A smooth altitude arc with zero slope at both ends, including nearby hops.
    zoom.value -= arc * 16 * t * t * (1 - t) * (1 - t);
    zoom.velocity -= arc * 32 * t * (1 - t) * (1 - 2 * t) / duration;
    const boundedZoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), zoom.value));
    velocity = { x: x.velocity, y: y.velocity, zoom: boundedZoom === zoom.value ? zoom.velocity : 0 };
    if (t === 1) {
      move(destination, to.zoom);
      cancel();
    } else {
      move(map.unproject(point(x.value, y.value), projectionZoom), boundedZoom);
      frame = requestAnimationFrame(step);
    }
  };
  const navigate = (coordinates, zoom, { duration }) => {
    if (!trajectory) {
      if (map._animatingZoom) map._onZoomTransitionEnd();
      map._stop();
      velocity = { x: 0, y: 0, zoom: 0 };
    }
    const from = map.project(map.getCenter(), projectionZoom);
    const to = map.project(coordinates, projectionZoom);
    const startZoom = map.getZoom();
    const screenDistance = from.distanceTo(to) * map.getZoomScale(Math.min(startZoom, zoom), projectionZoom);
    const viewport = Math.max(1, Math.max(map.getSize().x, map.getSize().y));
    const cruiseZoom = Math.max(map.getMinZoom(), Math.min(startZoom, zoom) - Math.log2(1 + screenDistance / viewport));
    const wasActive = !!trajectory;
    trajectory = {
      from: { x: from.x, y: from.y, zoom: startZoom },
      to: { x: to.x, y: to.y, zoom }, initialVelocity: { ...velocity },
      duration: duration * 1000, destination: latLng(coordinates),
      arc: Math.max(0, (startZoom + zoom) / 2 - cruiseZoom),
    };
    elapsed = 0;
    lastTime = performance.now();
    if (!wasActive) {
      ownMove = true;
      try { map._moveStart(true); } finally { ownMove = false; }
    }
    if (frame === null) frame = requestAnimationFrame(step);
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
