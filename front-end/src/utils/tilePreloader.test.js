import { getFlightCorridorTileUrls, latLngToTile } from "./tilePreloader";

const properties = [
  { coordinates: [10.737, 122.5] },
  { coordinates: [10.671, 122.33] },
];

function tileKey(url) {
  const match = url.match(/[&?]x=(\d+)&y=(\d+)&z=(\d+)/);
  return match ? `${match[3]}/${match[1]}/${match[2]}` : "invalid";
}

test("warms every zoom-8 parent crossed by Oton to Guimbal", () => {
  const { macro } = getFlightCorridorTileUrls(properties);
  const keys = new Set(macro.map(tileKey));
  const oton = latLngToTile(10.737, 122.5, 8);
  const guimbal = latLngToTile(10.671, 122.33, 8);
  expect(keys).toContain(`8/${oton.x}/${oton.y}`);
  expect(keys).toContain(`8/${guimbal.x}/${guimbal.y}`);
  expect(oton.x).not.toBe(guimbal.x);
});

test("creates bounded, duplicate-free zoom-12 and zoom-13 corridor requests", () => {
  const { overview } = getFlightCorridorTileUrls(properties);
  expect(new Set(overview).size).toBe(overview.length);
  expect(overview.length).toBeLessThanOrEqual(96);
  expect(overview.some((url) => /[&?]z=12(?:&|$)/.test(url))).toBe(true);
  expect(overview.some((url) => /[&?]z=13(?:&|$)/.test(url))).toBe(true);
});
