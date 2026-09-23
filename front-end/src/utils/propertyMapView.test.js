import { getPropertyFallbackCoordinates } from "./geocoding";
import { loadPropertyMapView, savePropertyMapView } from "./propertyMapView";

beforeEach(() => localStorage.clear());

test("property location fallback follows address, not database ID", () => {
  expect(getPropertyFallbackCoordinates(3, "Brgy. Abilay Norte, Oton, Iloilo", "Lot-2018 Oton Cadastre"))
    .toEqual([10.7372, 122.4998]);
  expect(getPropertyFallbackCoordinates(2, "Brgy. Nanga, Guimbal, Iloilo", "Lot-204 Nanga Guimbal"))
    .toEqual([10.6713, 122.3353]);
});

test("empty properties retain separate map positions", () => {
  savePropertyMapView(3, {
    getCenter: () => ({ lat: 10.741, lng: 122.508 }),
    getZoom: () => 18.5,
  });
  expect(loadPropertyMapView(3)).toEqual({ center: [10.741, 122.508], zoom: 18.5 });
  expect(loadPropertyMapView(1)).toBeNull();
});
