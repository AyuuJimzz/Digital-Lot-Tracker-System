import { candidateInsideCrop, projectLotCandidate, sourcePointToOverlay } from "./blueprintLotProjection";

const source = { imageWidth: 1200, imageHeight: 800 };

test("source pixels retain their positions without a crop or rotation", () => {
  expect(sourcePointToOverlay([0.2, 0.8], source)).toEqual([0.2, 0.8]);
});

test("quarter turn matches canvas rotation for a non-square blueprint", () => {
  const [x, y] = sourcePointToOverlay([0, 0], source, 90);
  expect(x).toBeCloseTo(1, 10);
  expect(y).toBeCloseTo(0, 10);
  const [cx, cy] = sourcePointToOverlay([0.5, 0.5], source, 90);
  expect(cx).toBeCloseTo(0.5, 10);
  expect(cy).toBeCloseTo(0.5, 10);
});

test("arbitrary rotation follows the padded, rounded canvas dimensions", () => {
  const [x, y] = sourcePointToOverlay([0.75, 0.25], source, -30);
  // Independent forward rotation of pixel offset (300, -200).
  const width = Math.floor(1200 * Math.cos(Math.PI / 6) + 400);
  const height = Math.floor(600 + 800 * Math.cos(Math.PI / 6));
  expect(x).toBeCloseTo((300 * Math.cos(Math.PI / 6) - 100) / width + 0.5, 10);
  expect(y).toBeCloseTo((-150 - 200 * Math.cos(Math.PI / 6)) / height + 0.5, 10);
});

test("cropping maps original PDF coordinates into the cropped image", () => {
  const cropped = { ...source, cropBounds: { minX: 25, minY: 25, width: 50, height: 50 } };
  expect(sourcePointToOverlay([0.25, 0.25], cropped)).toEqual([0, 0]);
  expect(sourcePointToOverlay([0.75, 0.75], cropped)).toEqual([1, 1]);
  expect(sourcePointToOverlay([0.5, 0.5], cropped, 45)).toEqual([0.5, 0.5]);
});

test("projection interpolates the displayed image in map pixels, preserving latitude order", () => {
  const map = {
    project: ([lat, lng]) => ({ x: lng * 1000, y: -lat * lat * 1000 }),
    unproject: ([x, y]) => ({ lat: Math.sqrt(-y / 1000), lng: x / 1000 }),
  };
  const points = projectLotCandidate({ points: [[0, 0], [1, 1], [0.5, 0.5]] }, source, [[10, 122], [12, 124]], 0, map);
  expect(points[0]).toEqual([12, 122]);
  expect(points[1]).toEqual([10, 124]);
  expect(points[2]).toEqual([Math.sqrt(122), 123]);
  expect(points[2][0]).not.toBe(11);
});

test("polygon masks exclude lots outside the trace even within its bounding rectangle", () => {
  const crop = { minX: 0, minY: 0, maxX: 100, maxY: 100, polygon: [[0, 0], [1, 0], [0, 1]] };
  expect(candidateInsideCrop({ points: [[0.1, 0.1], [0.2, 0.1], [0.1, 0.2]] }, crop)).toBe(true);
  expect(candidateInsideCrop({ points: [[0.8, 0.8], [0.9, 0.8], [0.8, 0.9]] }, crop)).toBe(false);
});
