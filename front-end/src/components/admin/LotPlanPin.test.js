import L from "leaflet";
import { createLayerComponent } from "@react-leaflet/core";
import "./LotPlanPin";

// Capture the React adapter's factory, then exercise real Leaflet layers. The
// supplied pane is what React-Leaflet's withPane inherits from <Pane lot-plan>.
jest.mock("@react-leaflet/core", () => ({
  createLayerComponent: jest.fn(() => () => null),
  createElementObject: (instance, context) => ({ instance, context }),
  extendContext: (context, extra) => ({ ...context, ...extra }),
}));

const factory = createLayerComponent.mock.calls[0][0];
let map, element;
const createPin = (position) => {
  return factory({
    center: map.containerPointToLatLng(position),
    color: "#22c55e",
    pane: "lot-plan",
  }, { map, pane: "lot-plan" }).instance.addTo(map);
};

beforeEach(() => {
  element = document.createElement("div");
  Object.defineProperties(element, {
    clientWidth: { value: 1000 }, clientHeight: { value: 700 },
  });
  document.body.appendChild(element);
  map = L.map(element, { zoomAnimation: false, zoomSnap: 0 }).setView([10.6, 122.3], 19);
  map.createPane("lot-plan").style.zIndex = "410";
  const renderer = new L.SVG({ pane: "lot-plan" });
  L.polygon([[10.59, 122.29], [10.61, 122.29], [10.6, 122.31]], { renderer }).addTo(map);
});

afterEach(() => {
  map.remove();
  element.remove();
});

test("lot pins do not inherit the polygon pane where SVG can cover upper pins", () => {
  const upper = createPin([500, 100]);
  const lower = createPin([500, 500]);
  // Leaflet's SVG z-index is 200, while native marker z-index follows screen Y.
  expect(upper._zIndex).toBeLessThan(200);
  expect(lower._zIndex).toBeGreaterThan(200);
  for (const pin of [upper, lower]) {
    expect(pin.getElement().parentElement).toBe(map.getPane("markerPane"));
    expect(pin.getPane()).not.toBe(map.getPane("lot-plan"));
  }
});

test("upper and lower circles both open their own info on hover after pan and zoom", () => {
  const pins = [createPin([500, 100]), createPin([500, 500])];
  pins.forEach((pin, index) => pin.bindTooltip(`Lot ${index + 1}: Available`));
  const icons = pins.map((pin) => pin.getElement());
  map.panBy([0, 50], { animate: false });
  map.setZoom(19.25, { animate: false });
  pins.forEach((pin, index) => {
    const icon = pin.getElement();
    expect(icon).toBe(icons[index]);
    expect(icon.parentElement).toBe(map.getPane("markerPane"));
    icon.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    expect(pin.isTooltipOpen()).toBe(true);
    expect(pin.getTooltip().getContent()).toBe(`Lot ${index + 1}: Available`);
    icon.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    expect(pin.isTooltipOpen()).toBe(false);
  });
});
