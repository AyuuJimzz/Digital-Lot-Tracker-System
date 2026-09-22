import L from "leaflet";
import { getLotBounds, lotIntersectsBounds } from "../../utils/lotViewport";

test("keeps a lot that crosses the viewport even when its center is outside", () => {
  const lot = getLotBounds([[0, 0], [0, 10], [2, 10], [2, 0]]);
  const viewport = L.latLngBounds([[1, 9], [3, 11]]);
  expect(lotIntersectsBounds(lot, viewport)).toBe(true);
  expect(lotIntersectsBounds(lot, L.latLngBounds([[3, 11], [4, 12]]))).toBe(false);
});

test("applies the admin bulk shift before culling", () => {
  const lot = getLotBounds([[0, 0], [0, 1], [1, 1]]);
  const viewport = L.latLngBounds([[10, 10], [12, 12]]);
  expect(lotIntersectsBounds(lot, viewport)).toBe(false);
  expect(lotIntersectsBounds(lot, viewport, { lat: 10, lng: 10 })).toBe(true);
});

test("rejects incomplete or invalid polygon coordinates", () => {
  expect(getLotBounds([[0, 0], [1, 1]])).toBeNull();
  expect(getLotBounds([[0, 0], [1, NaN], [1, 1]])).toBeNull();
});
