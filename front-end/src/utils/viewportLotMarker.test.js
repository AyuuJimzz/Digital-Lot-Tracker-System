import L from "leaflet";
import { ViewportLotMarker } from "./viewportLotMarker";
import { createPropertyFlight } from "./propertyFlight";
import { attachSmoothWheelZoom } from "./smoothWheelZoom";

const maps = [];
const icon = () => L.divIcon({
  className: "lot-plan-pin lot-plan-pin-marker",
  html: '<div style="width:14px;height:14px;border-radius:50%"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function makeMap() {
  const element = document.createElement("div");
  Object.defineProperties(element, {
    clientWidth: { value: 1000 }, clientHeight: { value: 700 },
  });
  document.body.appendChild(element);
  const map = L.map(element, {
    zoomAnimation: false, zoomSnap: 0, minZoom: 1, maxZoom: 28,
  }).setView([10.6, 122.3], 19);
  maps.push({ map, element });
  return map;
}

function addPin(map, containerPoint, Marker = ViewportLotMarker) {
  return new Marker(map.containerPointToLatLng(containerPoint), { icon: icon() }).addTo(map);
}

function expectNativePosition(marker) {
  const expected = marker._map.latLngToLayerPoint(marker.getLatLng()).round();
  expect(L.DomUtil.getPosition(marker.getElement())).toEqual(expected);
  expect(marker.getElement().style.zIndex).toBe(String(expected.y + marker.options.zIndexOffset));
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.restoreAllMocks();
  for (const { map, element } of maps.splice(0)) {
    if (map._mapPane) map.remove();
    element.remove();
  }
  jest.useRealTimers();
});

test("1,000 mounted pins only project and position the 10 visible pins per continuous zoom frame", () => {
  const map = makeMap();
  const baselineMap = makeMap();
  for (let i = 0; i < 1000; i++) {
    const position = i < 10 ? [430 + i * 14, 330] : [5000 + i * 5, 400];
    addPin(map, position);
    addPin(baselineMap, position, L.Marker);
  }
  const project = jest.spyOn(map, "project");
  const baselineProject = jest.spyOn(baselineMap, "project");
  const nativeSetPos = L.Marker.prototype._setPos;
  const writes = new Map();
  jest.spyOn(L.Marker.prototype, "_setPos").mockImplementation(function (position) {
    writes.set(this._map, (writes.get(this._map) || 0) + 1);
    return nativeSetPos.call(this, position);
  });

  for (let frame = 1; frame <= 3; frame++) {
    project.mockClear();
    baselineProject.mockClear();
    writes.clear();
    map._move(map.getCenter(), 19 + frame * 0.05, { flyTo: true });
    baselineMap._move(baselineMap.getCenter(), 19 + frame * 0.05, { flyTo: true });
    expect(writes.get(map)).toBe(10);
    expect(writes.get(baselineMap)).toBe(1000);
    expect(project.mock.calls.length).toBeLessThan(20);
    expect(baselineProject.mock.calls.length).toBeGreaterThanOrEqual(1000);
  }
});

test("pins entering and leaving the viewport retain native integer position and never leave a visible stale pin", () => {
  const map = makeMap();
  const pin = addPin(map, [2500, 350]);
  const setPos = jest.spyOn(pin, "_setPos");
  map._move(map.getCenter(), 19.1, { flyTo: true });
  expect(setPos).not.toHaveBeenCalled();

  map._move(pin.getLatLng(), 19.2, { flyTo: true });
  expect(setPos).toHaveBeenCalledTimes(1);
  expectNativePosition(pin);

  // Its destination is offscreen but the old DOM position is still visible.
  map._move([10.6, 122.3], 19.3, { flyTo: true });
  expect(setPos).toHaveBeenCalledTimes(2);
  expectNativePosition(pin);
  map._move([10.6, 122.3], 19.4, { flyTo: true });
  expect(setPos).toHaveBeenCalledTimes(2);
});

test("the full pin and shadow margin stays positioned at viewport edges after a pan", () => {
  const map = makeMap();
  map.panBy([140, -85], { animate: false });
  const pins = [[-10, 350], [1010, 350], [500, -10], [500, 710]]
    .map((position) => addPin(map, position));
  map._move(map.getCenter(), 19.001, { pinch: true, round: false });
  pins.forEach(expectNativePosition);
});

test.each(["zoomend", "moveend"])("%s restores deferred offscreen positions before another pan", (event) => {
  const map = makeMap();
  const pin = addPin(map, [3000, 350]);
  const original = L.DomUtil.getPosition(pin.getElement()).clone();
  map._move(map.getCenter(), 19.5, { pinch: true, round: false });
  expect(L.DomUtil.getPosition(pin.getElement())).toEqual(original);
  map.fire(event);
  expectNativePosition(pin);
  map.panBy([1800, 0], { animate: false });
  expectNativePosition(pin);
});

test("native zoom, viewreset, coordinate edits, and icon changes keep native marker behavior", () => {
  const map = makeMap();
  const pin = addPin(map, [3000, 350]);
  map._move(map.getCenter(), 19.5, { flyTo: true });
  pin.setLatLng(map.containerPointToLatLng([3500, 450]));
  expectNativePosition(pin);
  map._move(map.getCenter(), 19.6, { flyTo: true });
  const replacement = icon();
  pin.setIcon(replacement);
  expect(pin.getIcon()).toBe(replacement);
  expectNativePosition(pin);
  map._move(map.getCenter(), 19.7, { flyTo: true });
  map._move(map.getCenter(), 20);
  expectNativePosition(pin);
  map._move(map.getCenter(), 20.1, { flyTo: true });
  map.fire("viewreset");
  expectNativePosition(pin);

  const destination = { center: L.latLng(10.61, 122.31), zoom: 21 };
  pin._animateZoom(destination);
  expect(L.DomUtil.getPosition(pin.getElement())).toEqual(
    map._latLngToNewLayerPoint(pin.getLatLng(), destination.zoom, destination.center).round()
  );
});

test("existing flight retarget/cancel and wheel motion leave marker positions correct", () => {
  const map = makeMap();
  const near = addPin(map, [500, 350]);
  const far = addPin(map, [8000, 350]);
  const flight = createPropertyFlight(map);
  const disposeWheel = attachSmoothWheelZoom(map);
  const onZoom = () => expectNativePosition(near);
  map.on("zoom", onZoom);
  try {
    flight.navigate([10.60005, 122.3001], 19.3, { duration: 1, straight: true });
    jest.advanceTimersByTime(250);
    flight.navigate([10.60002, 122.30002], 19.2, { duration: 1, straight: true });
    jest.advanceTimersByTime(250);
    flight.cancel();
    [near, far].forEach(expectNativePosition);

    map.getContainer().dispatchEvent(new WheelEvent("wheel", {
      deltaY: -120, clientX: 730, clientY: 260, bubbles: true, cancelable: true,
    }));
    jest.advanceTimersByTime(1200);
    [near, far].forEach(expectNativePosition);
  } finally {
    map.off("zoom", onZoom);
    disposeWheel();
    flight.dispose();
  }
});

test("the same marker DOM, click interaction, and tooltip survive deferred positioning", () => {
  const map = makeMap();
  const pin = addPin(map, [3000, 350]);
  const element = pin.getElement();
  const click = jest.fn();
  pin.on("click", click).bindTooltip("Lot 42");
  const tooltip = pin.getTooltip();
  map._move(map.getCenter(), 19.5, { flyTo: true });
  map._move(pin.getLatLng(), 19.6, { flyTo: true });
  map._moveEnd(true);
  expect(pin.getElement()).toBe(element);
  expect(pin.getTooltip()).toBe(tooltip);
  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  expect(click).toHaveBeenCalledTimes(1);
  pin.openTooltip();
  expect(pin.isTooltipOpen()).toBe(true);
  expect(tooltip.getContent()).toBe("Lot 42");
});

test("removing the last pin releases shared listeners and readding it works", () => {
  const map = makeMap();
  const eventCount = (event) => (map._events[event] || []).length;
  const baseline = [eventCount("zoomend"), eventCount("moveend")];
  const first = addPin(map, [3000, 350]);
  const second = addPin(map, [3500, 350]);
  expect([eventCount("zoomend"), eventCount("moveend")]).toEqual(baseline.map((count) => count + 1));
  map._move(map.getCenter(), 19.5, { flyTo: true });
  first.remove();
  second.remove();
  expect([eventCount("zoomend"), eventCount("moveend")]).toEqual(baseline);
  first.addTo(map);
  expectNativePosition(first);
  map._move(map.getCenter(), 19.6, { flyTo: true });
  map.fire("zoomend");
  expectNativePosition(first);
  map.remove();
  expect([eventCount("zoomend"), eventCount("moveend")]).toEqual([0, 0]);
});
