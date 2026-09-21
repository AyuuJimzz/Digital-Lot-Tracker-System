import L from "leaflet";
import { act, renderHook } from "@testing-library/react";
import { createPropertyFlight } from "./propertyFlight";
import { usePropertyMapNavigation, waitForPropertyFlight } from "../hooks/usePropertyMapNavigation";
import { attachSmoothWheelZoom } from "./smoothWheelZoom";

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
afterEach(() => { flight.dispose(); map.remove(); element.remove(); jest.useRealTimers(); });
const camera = () => ({ ...map.project(map.getCenter(), 19), zoom: map.getZoom() });

test("rapid reversals preserve camera position and velocity in a single lifecycle", () => {
  const started = jest.fn(), ended = jest.fn(), reset = jest.fn();
  map.on("movestart", started).on("moveend", ended).on("viewreset", reset);
  flight.navigate([10.68, 122.4], 19, { duration: 3 });
  jest.advanceTimersByTime(784);
  const before = camera();
  jest.advanceTimersByTime(16);
  const current = camera();
  flight.navigate([10.55, 122.2], 19, { duration: 3 });
  expect(camera()).toEqual(current);
  jest.advanceTimersByTime(16);
  const after = camera();
  console.log({ before, current, after });
  for (const axis of ["x", "y", "zoom"]) {
    const incoming = current[axis] - before[axis];
    const outgoing = after[axis] - current[axis];
    expect(Math.abs(outgoing - incoming)).toBeLessThan(Math.abs(incoming) * 0.2);
  }
  for (let i = 0; i < 10; i++) {
    flight.navigate([10.6 + i * 0.001, 122.3 - i * 0.001], 19, { duration: 2 });
    jest.advanceTimersByTime(48);
  }
  expect(started).toHaveBeenCalledTimes(1);
  expect(ended).not.toHaveBeenCalled();
  jest.advanceTimersByTime(3000);
  expect(map.getCenter().distanceTo(L.latLng(10.609, 122.291))).toBeLessThan(0.01);
  expect(map.getZoom()).toBe(19);
  expect(ended).toHaveBeenCalledTimes(1);
  expect(reset).not.toHaveBeenCalled();
});

test("nearby flights stay animated and slow progressively into an exact landing", () => {
  const samples = [];
  map.on("move", () => samples.push(camera()));
  flight.navigate([10.6005, 122.3005], 19, { duration: 1.8 });
  jest.advanceTimersByTime(896);
  expect(map.getZoom()).toBeLessThan(19);
  const mid = samples[samples.length - 1].x - samples[samples.length - 2].x;
  jest.advanceTimersByTime(880);
  const landing = samples[samples.length - 1].x - samples[samples.length - 2].x;
  expect(landing).toBeGreaterThan(0);
  expect(landing).toBeLessThan(mid * 0.1);
  jest.advanceTimersByTime(64);
  expect(map.getCenter().distanceTo(L.latLng(10.6005, 122.3005))).toBeLessThan(0.01);
  expect(map.getZoom()).toBe(19);
});

test("cancellation and external navigation leave no stale animation running", () => {
  flight.navigate([10.7, 122.4], 18.5, { duration: 3 });
  jest.advanceTimersByTime(400);
  const displayed = camera();
  flight.cancel();
  jest.advanceTimersByTime(5000);
  expect(camera()).toEqual(displayed);
  flight.navigate([10.7, 122.4], 18.5, { duration: 3 });
  jest.advanceTimersByTime(400);
  map.setView([10.55, 122.22], 20, { animate: false });
  jest.advanceTimersByTime(5000);
  expect(map.getCenter().distanceTo(L.latLng(10.55, 122.22))).toBeLessThan(0.01);
  expect(map.getZoom()).toBe(20);
});

test("a delayed frame is bounded instead of jumping ahead by the entire stall", () => {
  const frames = [];
  const raf = jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { frames.push(callback); return frames.length; });
  flight.navigate([10.7, 122.4], 19, { duration: 3 });
  frames.shift()(16);
  const before = camera();
  frames.shift()(1016);
  const after = camera();
  const totalDistance = map.project([10.7, 122.4], 19).distanceTo(map.project([10.6, 122.3], 19));
  expect(L.point(after.x, after.y).distanceTo(L.point(before.x, before.y))).toBeLessThan(totalDistance * 0.01);
  flight.cancel();
  raf.mockRestore();
});

test("zoom stays finite and bounded while repeatedly retargeting fractional zooms", () => {
  const check = jest.fn(() => {
    expect(Number.isFinite(map.getCenter().lat)).toBe(true);
    expect(Number.isFinite(map.getCenter().lng)).toBe(true);
    expect(map.getZoom()).toBeGreaterThanOrEqual(1);
    expect(map.getZoom()).toBeLessThanOrEqual(28);
  });
  map.on("move", check);
  [28, 1, 20.5, 18.5].forEach((zoom) => {
    flight.navigate([10.7, 122.4], zoom, { duration: 2 });
    jest.advanceTimersByTime(640);
  });
  jest.advanceTimersByTime(3000);
  expect(map.getZoom()).toBe(18.5);
  expect(check).toHaveBeenCalled();
});

test("real navigation hook keeps one flight active across switches; wheel cancels at the displayed view", async () => {
  flight.dispose();
  const started = jest.fn(), ended = jest.fn();
  const { unmount } = renderHook(() => usePropertyMapNavigation(map, { onFlightStart: started, onFlightEnd: ended }));
  const disposeWheel = attachSmoothWheelZoom(map);
  const navigate = (coordinates) => act(() => window.dispatchEvent(new CustomEvent("navigateToProperty", { detail: { coordinates } })));
  navigate([10.7, 122.4]);
  act(() => jest.advanceTimersByTime(400));
  navigate([10.55, 122.2]);
  act(() => jest.advanceTimersByTime(400));
  expect(started).toHaveBeenCalledTimes(1);
  expect(ended).not.toHaveBeenCalled();
  const ready = jest.fn();
  const waiting = waitForPropertyFlight(map).then(ready);
  act(() => element.dispatchEvent(new WheelEvent("wheel", { deltaY: -120, clientX: 500, clientY: 350, cancelable: true })));
  expect(ended).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(5000));
  await waiting;
  expect(ready).toHaveBeenCalledTimes(1);
  expect(element.classList.contains("map-is-flying")).toBe(false);
  navigate([10.601, 122.301]);
  act(() => jest.advanceTimersByTime(5000));
  expect(map.getCenter().distanceTo(L.latLng(10.601, 122.301))).toBeLessThan(0.01);
  expect(ended).toHaveBeenCalledTimes(2);
  unmount(); disposeWheel();
});
