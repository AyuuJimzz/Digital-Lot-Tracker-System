import { containsPoint } from "./geometry.js";

// Exclude connected table cells, not an entire horizontal band of the page:
// side-by-side tables and parcels often occupy exactly the same Y coordinates.
export function findTableFaces(faces, labels) {
  const cells = faces.filter((points) => points.length <= 30 && points.every((point, i) => {
    const next = points[(i + 1) % points.length];
    return Math.abs(point[0] - next[0]) < 0.05 || Math.abs(point[1] - next[1]) < 0.05;
  }));
  const edges = new Map(), neighbors = cells.map(() => new Set());
  cells.forEach((points, i) => points.forEach((point, j) => {
    const key = [point.join(","), points[(j + 1) % points.length].join(",")].sort().join(":");
    for (const previous of edges.get(key) || []) { neighbors[i].add(previous); neighbors[previous].add(i); }
    if (!edges.has(key)) edges.set(key, []);
    edges.get(key).push(i);
  }));
  const markers = labels.filter((label) => /\b(?:TECHNICAL\s+DESCRIPTION|BEARINGS|DISTANCES|SUMMARY|DENSITY|TOTAL\s+(?:GROSS|EXCLUDED)|SALEABLE\s+AREA|GEODETIC|OWNER\/DEVELOPER)\b/i.test(label.text));
  const pending = [];
  cells.forEach((points, i) => { if (markers.some((label) => containsPoint(points, label.point))) pending.push(i); });
  const excluded = new Set();
  while (pending.length) {
    const index = pending.pop();
    if (excluded.has(cells[index])) continue;
    excluded.add(cells[index]);
    for (const neighbor of neighbors[index]) pending.push(neighbor);
  }
  return excluded;
}
