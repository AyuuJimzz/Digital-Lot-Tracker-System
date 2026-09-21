import L from "leaflet";
import { attachSmoothWheelZoom } from "./smoothWheelZoom";

let map, element, dispose;
beforeEach(() => {
  jest.useFakeTimers();
  element = document.createElement("div");
  Object.defineProperties(element, { clientWidth: { value: 1000 }, clientHeight: { value: 700 } });
  document.body.appendChild(element);
  map = L.map(element, { zoomAnimation: false, zoomSnap: 0, minZoom: 1, maxZoom: 28 }).setView([10.6, 122.3], 19);
  dispose = attachSmoothWheelZoom(map);
});
afterEach(() => { dispose(); map.remove(); element.remove(); jest.useRealTimers(); });
const wheel = (deltaY, extra = {}) => element.dispatchEvent(new WheelEvent("wheel", {
  deltaY, clientX: 730, clientY: 260, bubbles: true, cancelable: true, ...extra,
}));

test("wheel ticks accumulate into one continuous, cursor-anchored zoom without resetting the view", () => {
  const started = jest.fn(), ended = jest.fn(), reset = jest.fn();
  map.on("zoomstart", started).on("zoomend", ended).on("viewreset", reset);
  const anchor = map.containerPointToLatLng([730, 260]);
  wheel(-120);
  jest.advanceTimersByTime(64);
  const first = map.getZoom();
  expect(first).toBeGreaterThan(19);
  expect(first).toBeLessThan(19.4);
  wheel(-120);
  jest.advanceTimersByTime(80);
  expect(map.getZoom()).toBeGreaterThan(first);
  expect(ended).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1200);
  expect(map.getZoom()).toBeCloseTo(19.8, 5);
  expect(map.latLngToContainerPoint(anchor).distanceTo(L.point(730, 260))).toBeLessThan(1.5);
  expect(started).toHaveBeenCalledTimes(1);
  expect(ended).toHaveBeenCalledTimes(1);
  expect(reset).not.toHaveBeenCalled();
});

test("reversing scroll is smooth and a new property flight cancels the wheel loop at its visible position", () => {
  wheel(-120); jest.advanceTimersByTime(80);
  wheel(120); jest.advanceTimersByTime(1200);
  expect(map.getZoom()).toBeCloseTo(19, 5);
  wheel(-120); jest.advanceTimersByTime(64);
  const interruptedZoom = map.getZoom();
  map.fire("propertyflightstart");
  jest.advanceTimersByTime(1200);
  expect(map.getZoom()).toBe(interruptedZoom);
  expect(element.classList.contains("map-wheel-zooming")).toBe(false);
});

test("respects zoom limits, ignores form controls, and restores the native handler on cleanup", () => {
  map.setView([10.6, 122.3], 27.9);
  wheel(-120); jest.advanceTimersByTime(1200);
  expect(map.getZoom()).toBe(28);
  const input = document.createElement("input"); element.appendChild(input);
  input.dispatchEvent(new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true }));
  jest.advanceTimersByTime(1200);
  expect(map.getZoom()).toBe(28);
  expect(map.scrollWheelZoom.enabled()).toBe(false);
  dispose(); dispose = () => {};
  expect(map.scrollWheelZoom.enabled()).toBe(true);
});

test("zoom stays anchored after dragging and pointer interruption preserves the displayed position", () => {
  map.panBy([140, -85], { animate: false });
  const anchor = map.containerPointToLatLng([730, 260]);
  wheel(-120); jest.advanceTimersByTime(1200);
  expect(map.latLngToContainerPoint(anchor).distanceTo(L.point(730, 260))).toBeLessThan(1.5);
  wheel(120); jest.advanceTimersByTime(64);
  const zoom = map.getZoom(), center = map.getCenter();
  element.dispatchEvent(new Event("pointerdown"));
  jest.advanceTimersByTime(1200);
  expect(map.getZoom()).toBe(zoom);
  expect(map.getCenter().distanceTo(center)).toBeLessThan(0.01);
  expect(element.classList.contains("map-wheel-zooming")).toBe(false);
});

test("a native keyboard/button zoom can take over without the wheel loop moving the camera back", () => {
  wheel(-120); jest.advanceTimersByTime(64);
  map.setView([10.65, 122.4], 20, { animate: false });
  jest.advanceTimersByTime(1200);
  expect(map.getZoom()).toBe(20);
  expect(map.getCenter().distanceTo(L.latLng(10.65, 122.4))).toBeLessThan(0.01);
  expect(element.classList.contains("map-wheel-zooming")).toBe(false);
});
