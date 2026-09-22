import L from "leaflet";
import { act, renderHook } from "@testing-library/react";
import { createPropertyFlight } from "./propertyFlight";
import { usePropertyMapNavigation } from "../hooks/usePropertyMapNavigation";
import { attachSmoothWheelZoom } from "./smoothWheelZoom";
import { ViewportLotMarker } from "./viewportLotMarker";

jest.mock("./tilePreloader", () => ({ preloadLocationTiles: () => () => {} }));

let map, element, flight;
beforeEach(() => {
  jest.useFakeTimers();
  element = document.createElement("div");
  Object.defineProperties(element, { clientWidth: { value: 1000 }, clientHeight: { value: 700 } });
  document.body.appendChild(element);
  map = L.map(element, { zoomAnimation: false, zoomSnap: 0, minZoom: 1, maxZoom: 28 }).setView([10.6, 122.3], 19);
  flight = createPropertyFlight(map);
});
afterEach(() => {
  flight.dispose(); map.remove(); element.remove();
  jest.restoreAllMocks(); jest.useRealTimers();
});
const camera = () => ({ ...map.project(map.getCenter(), 19), zoom: map.getZoom() });

test("flight follows a straight line from origin to destination (no curves)", () => {
  const samples = [];
  map.on("move", () => samples.push(camera()));
  flight.navigate([10.68, 122.4], 19, { duration: 3 });
  jest.advanceTimersByTime(3100);
  // All intermediate points should lie on the line from start to end.
  const start = samples[0];
  const end = samples[samples.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  for (const s of samples) {
    const cross = Math.abs((s.x - start.x) * dy - (s.y - start.y) * dx) / len;
    expect(cross).toBeLessThan(1);
  }
  expect(map.getCenter().distanceTo(L.latLng(10.68, 122.4))).toBeLessThan(0.01);
  expect(map.getZoom()).toBe(19);
});

test("phased animation: position barely moves during zoom-out phase", () => {
  const origin = map.project([10.6, 122.3], 19);
  const dest = map.project([10.68, 122.4], 19);
  const totalDist = origin.distanceTo(dest);
  flight.navigate([10.68, 122.4], 19, { duration: 3 });
  // After 10% of duration (300ms), zoom should have changed but position should barely move.
  jest.advanceTimersByTime(300);
  const pos = camera();
  const traveled = Math.sqrt((pos.x - origin.x) ** 2 + (pos.y - origin.y) ** 2);
  // Position easing delays start: at t=0.1, positionEase is near 0.
  expect(traveled / totalDist).toBeLessThan(0.05);
});

test("retarget mid-flight goes straight to new destination from current position", () => {
  const started = jest.fn(), ended = jest.fn();
  map.on("movestart", started).on("moveend", ended);
  flight.navigate([10.68, 122.4], 19, { duration: 3 });
  jest.advanceTimersByTime(800);
  // Retarget to opposite direction
  flight.navigate([10.55, 122.2], 19, { duration: 3 });
  // Advance past throttle window
  jest.advanceTimersByTime(100);
  const posAfterRetarget = camera();
  const samples = [];
  map.on("move", () => samples.push(camera()));
  jest.advanceTimersByTime(3100);
  // After retarget, path should be straight from retarget position to new destination
  if (samples.length > 2) {
    const start = { x: posAfterRetarget.x, y: posAfterRetarget.y };
    const end = samples[samples.length - 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      for (const s of samples.slice(1)) {
        const cross = Math.abs((s.x - start.x) * dy - (s.y - start.y) * dx) / len;
        expect(cross).toBeLessThan(1);
      }
    }
  }
  expect(map.getCenter().distanceTo(L.latLng(10.55, 122.2))).toBeLessThan(0.01);
  expect(started).toHaveBeenCalledTimes(1); // lifecycle not restarted
  expect(ended).toHaveBeenCalledTimes(1);
});

test("nearby flight has smooth zoom arc and exact landing", () => {
  const samples = [];
  map.on("move", () => samples.push(camera()));
  flight.navigate([10.6005, 122.3005], 19, { duration: 1.8 });
  jest.advanceTimersByTime(1900);
  const minZoom = Math.min(...samples.map(s => s.zoom));
  expect(minZoom).toBeLessThan(19);
  expect(map.getCenter().distanceTo(L.latLng(10.6005, 122.3005))).toBeLessThan(0.01);
  expect(map.getZoom()).toBe(19);
});

test("straight flight moves directly toward target with no zoom-out arc", () => {
  const samples = [];
  map.on("move", () => samples.push(camera()));
  flight.navigate([10.68, 122.4], 18.5, { duration: 2, straight: true });
  jest.advanceTimersByTime(2100);
  for (const s of samples) {
    expect(s.zoom).toBeLessThanOrEqual(19.001);
    expect(s.zoom).toBeGreaterThanOrEqual(18.499);
  }
  expect(map.getCenter().distanceTo(L.latLng(10.68, 122.4))).toBeLessThan(0.01);
  expect(map.getZoom()).toBe(18.5);
});

test("straight flight from zoomed-out view immediately moves and never zooms farther out", () => {
  map.setView([10.5, 122.2], 10);
  const samples = [];
  map.on("move", () => samples.push(camera()));
  flight.navigate([10.68, 122.4], 19, { duration: 2, straight: true });
  jest.advanceTimersByTime(2100);
  expect(samples.length).toBeGreaterThan(5);
  // Zoom must NEVER drop below start zoom (10)
  for (const s of samples) {
    expect(s.zoom).toBeGreaterThanOrEqual(9.999);
    expect(s.zoom).toBeLessThanOrEqual(19.001);
  }
  // Path must be straight line from start to end (no curved arc)
  const start = samples[0];
  const end = samples[samples.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  for (const s of samples) {
    const cross = Math.abs((s.x - start.x) * dy - (s.y - start.y) * dx) / len;
    expect(cross).toBeLessThan(1);
  }
  expect(map.getCenter().distanceTo(L.latLng(10.68, 122.4))).toBeLessThan(0.01);
  expect(map.getZoom()).toBe(19);
});

test("cancellation and external navigation leave no stale animation running", () => {
  flight.navigate([10.7, 122.4], 18.5, { duration: 3 });
  jest.advanceTimersByTime(400);
  flight.cancel();
  const posAfterCancel = camera();
  jest.advanceTimersByTime(400);
  expect(camera()).toEqual(posAfterCancel);
  map.setView([10.8, 122.5], 17);
  expect(map.getCenter().distanceTo(L.latLng(10.8, 122.5))).toBeLessThan(0.01);
});

test("rapid-fire navigates are throttled — only latest destination is used", () => {
  flight.navigate([10.7, 122.4], 19, { duration: 3 });
  jest.advanceTimersByTime(16); // first frame fires
  // Rapid-fire 5 retargets within 60ms
  for (let i = 0; i < 5; i++) {
    flight.navigate([10.6 + i * 0.01, 122.3 + i * 0.01], 19, { duration: 3 });
  }
  // Advance past throttle window and complete flight
  jest.advanceTimersByTime(3200);
  // Should land at the LAST requested destination
  expect(map.getCenter().distanceTo(L.latLng(10.64, 122.34))).toBeLessThan(0.01);
});

test("zoom stays finite and bounded while repeatedly retargeting", () => {
  for (let i = 0; i < 20; i++) {
    flight.navigate([10.6 + i * 0.01, 122.3 - i * 0.01], 19 + (i % 3) * 0.3, { duration: 2 });
    jest.advanceTimersByTime(100);
    const z = map.getZoom();
    expect(z).toBeGreaterThanOrEqual(map.getMinZoom());
    expect(z).toBeLessThanOrEqual(map.getMaxZoom());
    expect(Number.isFinite(z)).toBe(true);
  }
  jest.advanceTimersByTime(3000);
  expect(Number.isFinite(map.getZoom())).toBe(true);
});

test("real navigation hook keeps one flight active across switches; wheel cancels at the displayed view", () => {
  flight.dispose();
  const started = jest.fn(), ended = jest.fn();
  const { unmount } = renderHook(() => usePropertyMapNavigation(map, { onFlightStart: started, onFlightEnd: ended }));
  const disposeWheel = attachSmoothWheelZoom(map);
  const navigate = (coordinates) => act(() => window.dispatchEvent(new CustomEvent("navigateToProperty", { detail: { coordinates } })));
  navigate([10.7, 122.4]);
  jest.advanceTimersByTime(400);
  expect(started).toHaveBeenCalledTimes(1);
  navigate([10.65, 122.35]);
  jest.advanceTimersByTime(16);
  expect(started).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(5000);
  expect(map.getCenter().distanceTo(L.latLng(10.65, 122.35))).toBeLessThan(0.01);
  expect(ended).toHaveBeenCalledTimes(1);
  disposeWheel();
  unmount();
});

function controlFrames() {
  let pending;
  const now = jest.spyOn(performance, "now").mockReturnValue(0);
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    pending = callback;
    return 1;
  });
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => { pending = null; });
  return {
    now,
    run(time) {
      const callback = pending;
      pending = null;
      callback(time);
    },
    hasPending: () => Boolean(pending),
  };
}

test.each([
  [1.2, 30], [1.2, 60], [1.2, 120],
  [1.8, 30], [1.8, 60], [1.8, 120],
])("%s-second flight follows display time at %i Hz despite callback delays", (duration, hz) => {
  const frames = controlFrames();
  const destination = L.latLng(10.68, 122.4);
  const midpoint = map.project(map.getCenter(), 19).add(map.project(destination, 19)).divideBy(2);
  flight.navigate(destination, 18.5, { duration, straight: true });
  // Work before this RAF callback must not change the animation's sampled time.
  frames.now.mockReturnValue(8000);
  const totalFrames = Math.round(duration * hz);
  const durationMs = duration * 1000;
  for (let index = 1; index <= totalFrames / 2; index++) frames.run(index * durationMs / totalFrames);
  expect(map.project(map.getCenter(), 19).distanceTo(midpoint)).toBeLessThan(0.00001);
  expect(map.getZoom()).toBeCloseTo(18.75, 8);
  for (let index = totalFrames / 2 + 1; index <= totalFrames; index++) frames.run(index * durationMs / totalFrames);
  expect(map.getCenter().distanceTo(destination)).toBeLessThan(0.01);
  expect(map.getZoom()).toBe(18.5);
  expect(frames.hasPending()).toBe(false);
});

test("long frame stalls cannot teleport the camera to its destination", () => {
  const frames = controlFrames();
  const origin = map.project(map.getCenter(), 19);
  const destination = L.latLng(10.68, 122.4);
  const distance = origin.distanceTo(map.project(destination, 19));
  flight.navigate(destination, 18.5, { duration: 2, straight: true });
  frames.run(5000);
  expect(origin.distanceTo(map.project(map.getCenter(), 19)) / distance).toBeLessThan(0.001);
  expect(map.getZoom()).toBeGreaterThan(18.99);
  expect(frames.hasPending()).toBe(true);
});

test("zoom takeoff and landing are gentle and the destination is committed once", () => {
  const frames = controlFrames();
  const moves = [];
  const ended = jest.fn();
  map.on("move", () => moves.push(camera())).on("moveend", ended);
  flight.navigate([10.68, 122.4], 19, { duration: 2 });
  for (let index = 1; index <= 100; index++) frames.run(index * 20);
  expect(Math.abs(moves[0].zoom - 19)).toBeLessThan(0.001);
  expect(Math.abs(moves[98].zoom - 19)).toBeLessThan(0.001);
  expect(Math.min(...moves.map(({ zoom }) => zoom))).toBeLessThan(18);
  expect(moves).toHaveLength(100);
  expect(ended).toHaveBeenCalledTimes(1);
  expect(map.getZoom()).toBe(19);
});

test("constant-zoom flights move pins, SVG and tiles every frame without rebuilding geometry", () => {
  const frames = controlFrames();
  const destination = L.latLng(10.6003, 122.3003);
  const renderer = new L.SVG();
  const polygon = L.polygon([[10.6, 122.3], [10.601, 122.3], [10.6, 122.301]], { renderer }).addTo(map);
  const pin = new ViewportLotMarker(destination, { icon: L.divIcon({ iconSize: [14, 14] }) }).addTo(map);
  const icon = pin.getElement();
  const tiles = L.gridLayer({ updateWhenZooming: true }).addTo(map);
  const project = jest.spyOn(polygon, "_project");
  const vectorTransform = jest.spyOn(renderer, "_updateTransform");
  const tileTransform = jest.spyOn(tiles, "_setZoomTransforms");
  flight.navigate(destination, 19, { duration: 2, straight: true });
  for (let index = 1; index <= 50; index++) frames.run(index * 20);
  expect(L.DomUtil.getPosition(icon)).toEqual(map.latLngToLayerPoint(destination));
  expect(project).not.toHaveBeenCalled();
  expect(vectorTransform).toHaveBeenCalledTimes(50);
  expect(tileTransform).toHaveBeenCalledTimes(50);
  for (let index = 51; index <= 100; index++) frames.run(index * 20);
  expect(project).toHaveBeenCalledTimes(1);
  expect(pin.getElement()).toBe(icon);
  expect(L.DomUtil.getPosition(icon)).toEqual(map.latLngToLayerPoint(destination));
  expect(map.getCenter().distanceTo(destination)).toBeLessThan(0.01);
});

test("a newer immediate destination cancels a delayed older retarget", () => {
  const frames = controlFrames();
  flight.navigate([10.7, 122.4], 19, { duration: 2, straight: true });
  frames.now.mockReturnValue(10);
  flight.navigate([10.8, 122.5], 19, { duration: 2, straight: true });
  frames.now.mockReturnValue(80);
  flight.navigate([10.9, 122.6], 19, { duration: 2, straight: true });
  jest.advanceTimersByTime(100);
  for (let index = 1; index <= 100; index++) frames.run(80 + index * 20);
  expect(map.getCenter().distanceTo(L.latLng(10.9, 122.6))).toBeLessThan(0.01);
  expect(map.getZoom()).toBe(19);
});
