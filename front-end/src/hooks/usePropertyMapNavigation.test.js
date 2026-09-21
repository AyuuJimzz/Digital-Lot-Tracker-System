import { act, renderHook } from "@testing-library/react";
import { usePropertyMapNavigation, waitForPropertyFlight } from "./usePropertyMapNavigation";
import { preloadLocationTiles } from "../utils/tilePreloader";

jest.mock("../utils/tilePreloader", () => ({ preloadLocationTiles: jest.fn(() => jest.fn()) }));
jest.mock("../utils/propertyFlight", () => ({
  createPropertyFlight: (map) => ({ navigate: map.flyTo, cancel: jest.fn(), dispose: jest.fn() }),
}));

function createMap() {
  const handlers = {};
  let center = [10, 122], zoom = 19;
  const map = {
    getContainer: () => container,
    getCenter: () => center, getZoom: () => zoom,
    arrive: (coordinates, targetZoom = 19) => { center = coordinates; zoom = targetZoom; map.fire("moveend"); },
    stop: jest.fn(),
    distance: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) * 100000,
    on: (events, handler) => events.split(" ").forEach((event) => (handlers[event] ||= new Set()).add(handler)),
    off: (events, handler) => events.split(" ").forEach((event) => handlers[event]?.delete(handler)),
    fire: (event) => [...(handlers[event] || [])].forEach((fn) => fn()),
    flyTo: jest.fn(() => map.fire("movestart")),
    panTo: jest.fn(() => map.fire("movestart")),
  };
  const container = document.createElement("div");
  return map;
}
const navigate = (coordinates) => window.dispatchEvent(new CustomEvent("navigateToProperty", { detail: { coordinates } }));

test("duplicate navigation does not restart; new destinations retarget and PDF work waits for arrival", async () => {
  const map = createMap(), setSelectedProperty = jest.fn();
  const { rerender } = renderHook((props) => usePropertyMapNavigation(map, props), {
    initialProps: { properties: [{ id: 2, coordinates: [11, 123] }], selectedProperty: 1, setSelectedProperty },
  });
  act(() => {
    navigate([11, 123]);
    window.dispatchEvent(new CustomEvent("selectProperty", { detail: { propertyId: 2 } }));
  });
  expect(map.flyTo).toHaveBeenCalledTimes(1);
  rerender({ properties: [{ id: 2, coordinates: [11, 123] }], selectedProperty: 2, setSelectedProperty });
  const ready = jest.fn();
  const waiting = waitForPropertyFlight(map).then(ready);
  await Promise.resolve();
  expect(ready).not.toHaveBeenCalled();
  act(() => navigate([12, 124]));
  expect(map.flyTo).toHaveBeenCalledTimes(2);
  act(() => map.arrive([12, 124]));
  await waiting;
  expect(ready).toHaveBeenCalledTimes(1);
  expect(map.getContainer().classList.contains("map-is-flying")).toBe(false);
});

test("rejects invalid coordinates, cleans up, and keeps the requested flight with reduced motion enabled", () => {
  const original = window.matchMedia;
  window.matchMedia = () => ({ matches: true });
  const map = createMap();
  const { unmount } = renderHook(() => usePropertyMapNavigation(map, {}));
  act(() => { navigate([NaN, 1]); navigate([91, 122]); navigate([10, 122]); });
  expect(map.panTo).not.toHaveBeenCalled();
  expect(map.flyTo).not.toHaveBeenCalled();
  act(() => navigate([11, 123]));
  expect(map.flyTo.mock.calls[0][2].animate).toBe(true);
  unmount();
  act(() => navigate([12, 124]));
  expect(map.flyTo).toHaveBeenCalledTimes(1);
  window.matchMedia = original;
});

test("nearby property switches retain a visible, unhurried flight instead of a short pan", () => {
  const map = createMap();
  renderHook(() => usePropertyMapNavigation(map, {}));

  act(() => navigate([10.004, 122.004]));

  expect(map.flyTo).toHaveBeenCalledWith(
    [10.004, 122.004],
    19,
    expect.objectContaining({ animate: true })
  );
  expect(map.flyTo.mock.calls[0][2].duration).toBeGreaterThanOrEqual(1.8);
  expect(map.flyTo.mock.calls[0][2].duration).toBeLessThan(2.5);
  expect(map.panTo).not.toHaveBeenCalled();
});

test("distant flights get a longer approach while retaining a bounded duration", () => {
  const map = createMap();
  renderHook(() => usePropertyMapNavigation(map, {}));
  act(() => navigate([10.004, 122.004]));
  const nearbyDuration = map.flyTo.mock.calls[0][2].duration;
  act(() => navigate([10.1, 122.1]));
  const distantDuration = map.flyTo.mock.calls[1][2].duration;
  expect(distantDuration).toBeGreaterThan(nearbyDuration);
  expect(distantDuration).toBeGreaterThan(3);
  expect(distantDuration).toBeLessThanOrEqual(3.8);
  expect(map.panTo).not.toHaveBeenCalled();
});

test("passes fractional zoom to the flight controller", () => {
  const map = createMap();
  renderHook(() => usePropertyMapNavigation(map, {}));

  act(() => {
    window.dispatchEvent(new CustomEvent("navigateToProperty", {
      detail: { coordinates: [11, 123], zoom: 18.5 },
    }));
  });

  expect(map.flyTo).toHaveBeenCalledWith(
    [11, 123],
    18.5,
    expect.objectContaining({ animate: true })
  );
  expect(map.panTo).not.toHaveBeenCalled();
});

test("reports the flight lifecycle so map views can limit marker work", () => {
  const map = createMap();
  const onFlightStart = jest.fn();
  const onFlightEnd = jest.fn();
  renderHook(() => usePropertyMapNavigation(map, { onFlightStart, onFlightEnd }));

  act(() => navigate([11, 123]));
  act(() => navigate([12, 124]));
  expect(onFlightStart).toHaveBeenCalledTimes(1);

  act(() => map.arrive([12, 124]));
  expect(onFlightEnd).toHaveBeenCalledTimes(1);
});

test("an old moveend does not resume details or release blueprint work before the current destination", async () => {
  const map = createMap(), resumed = jest.fn(), ready = jest.fn();
  map.on("propertyflightend", resumed);
  renderHook(() => usePropertyMapNavigation(map, { mapLayer: "hybrid" }));
  act(() => navigate([11, 123]));
  const waiting = waitForPropertyFlight(map).then(ready);
  act(() => { navigate([12, 124]); map.arrive([11, 123]); });
  expect(resumed).not.toHaveBeenCalled();
  expect(ready).not.toHaveBeenCalled();
  expect(preloadLocationTiles).toHaveBeenLastCalledWith(12, 124, [18, 19], "hybrid", 1);
  act(() => map.arrive([12, 124]));
  await waiting;
  expect(resumed).toHaveBeenCalledTimes(1);
  expect(ready).toHaveBeenCalledTimes(1);
});

test("manual wheel input cancels the flight and restores detail layers", async () => {
  const map = createMap(), resumed = jest.fn();
  map.on("propertyflightend", resumed);
  renderHook(() => usePropertyMapNavigation(map, {}));
  act(() => navigate([11, 123]));
  const waiting = waitForPropertyFlight(map);
  act(() => map.getContainer().dispatchEvent(new Event("wheel")));
  await waiting;
  expect(map.stop).toHaveBeenCalledTimes(1);
  expect(resumed).toHaveBeenCalledTimes(1);
  expect(map.getContainer().classList.contains("map-is-flying")).toBe(false);
});
