import { act, renderHook } from "@testing-library/react";
import { usePropertyMapNavigation, waitForPropertyFlight } from "./usePropertyMapNavigation";

function createMap() {
  const handlers = {};
  const map = {
    getContainer: () => container,
    getCenter: () => [10, 122], getZoom: () => 19,
    distance: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) * 100000,
    on: (events, handler) => events.split(" ").forEach((event) => (handlers[event] ||= new Set()).add(handler)),
    off: (events, handler) => events.split(" ").forEach((event) => handlers[event]?.delete(handler)),
    fire: (event) => [...(handlers[event] || [])].forEach((fn) => fn()),
    flyTo: jest.fn(() => map.fire("movestart")),
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
  act(() => map.fire("moveend"));
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
  expect(map.flyTo).not.toHaveBeenCalled();
  act(() => navigate([11, 123]));
  expect(map.flyTo.mock.calls[0][2].animate).toBe(true);
  unmount();
  act(() => navigate([12, 124]));
  expect(map.flyTo).toHaveBeenCalledTimes(1);
  window.matchMedia = original;
});
