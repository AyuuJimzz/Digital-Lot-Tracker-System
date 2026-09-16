import { yieldToBrowser } from "./paths.js";

const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const subtract = (a, b) => [a[0] - b[0], a[1] - b[1]];
const interpolate = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export function signedArea(points) {
  return points.reduce((area, point, i) => area + cross(point, points[(i + 1) % points.length]), 0) / 2;
}

export function containsPoint(points, point) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]; const b = points[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function splitPair(first, second, tolerance) {
  const r = subtract(first.b, first.a); const s = subtract(second.b, second.a);
  const delta = subtract(second.a, first.a);
  const denominator = cross(r, s);
  if (Math.abs(denominator) > 1e-8) {
    const t = cross(delta, s) / denominator; const u = cross(delta, r) / denominator;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) { first.cuts.push(t); second.cuts.push(u); }
    else {
      const rLength = Math.hypot(...r), sLength = Math.hypot(...s);
      // Some CAD exports stop dividers just short of the shared boundary. Extend
      // along the printed divider to an existing line, never diagonally to a
      // nearby corner. Cap the repair in page points and relative to line length.
      const shortExtension = (value, length) => (value < 0 || value > 1) &&
        Math.min(Math.abs(value), Math.abs(value - 1)) * length <= Math.min(1.4, length * 0.05);
      if (Math.abs(denominator) / (rLength * sLength) > 0.35 &&
        ((u >= 0 && u <= 1 && shortExtension(t, rLength)) ||
         (t >= 0 && t <= 1 && shortExtension(u, sLength)))) {
        first.cuts.push(t); second.cuts.push(u);
      }
    }
  }
  // CAD exports can stop a fraction of a point before a boundary or overlap it.
  for (const [source, target] of [[first, second], [second, first]]) {
    const direction = subtract(target.b, target.a);
    const squared = direction[0] ** 2 + direction[1] ** 2;
    for (const endpoint of [source.a, source.b]) {
      const relative = subtract(endpoint, target.a);
      const t = (relative[0] * direction[0] + relative[1] * direction[1]) / squared;
      if (t <= 0 || t >= 1) continue;
      const projected = interpolate(target.a, target.b, t);
      if (Math.hypot(...subtract(endpoint, projected)) <= tolerance) target.cuts.push(t);
    }
  }
}

export function bridgeDashedSegments(input, maxGap = 1.4) {
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const endpoints = [];
  input.forEach((s, idx) => {
    endpoints.push({ p: s.a, idx });
    endpoints.push({ p: s.b, idx });
  });
  const cs = Math.max(10, Math.ceil(maxGap * 3));
  const grid = new Map();
  endpoints.forEach((ep) => {
    const k = `${Math.floor(ep.p[0] / cs)},${Math.floor(ep.p[1] / cs)}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(ep);
  });
  const dangling = [];
  endpoints.forEach((ep) => {
    const gx = Math.floor(ep.p[0] / cs); const gy = Math.floor(ep.p[1] / cs);
    let degree = 0;
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) {
      for (const other of (grid.get(`${gx + dx},${gy + dy}`) || [])) {
        if (other !== ep && dist(ep.p, other.p) <= 0.25) degree += 1;
      }
    }
    if (degree === 0) dangling.push(ep);
  });
  const dGrid = new Map();
  dangling.forEach((ep) => {
    const k = `${Math.floor(ep.p[0] / cs)},${Math.floor(ep.p[1] / cs)}`;
    if (!dGrid.has(k)) dGrid.set(k, []);
    dGrid.get(k).push(ep);
  });
  const bridges = [];
  const added = new Set();
  const minAlignment = maxGap > 2 ? 0.95 : 0.995;
  dangling.forEach((ep1) => {
    const gx = Math.floor(ep1.p[0] / cs); const gy = Math.floor(ep1.p[1] / cs);
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) {
      for (const ep2 of (dGrid.get(`${gx + dx},${gy + dy}`) || [])) {
        if (ep1.idx === ep2.idx) continue;
        const d = dist(ep1.p, ep2.p);
        if (d > 0.25 && d <= maxGap) {
          // Repair short breaks along straight or gently curved boundary segments
          const first = input[ep1.idx], second = input[ep2.idx];
          if (first.curved && second.curved && maxGap <= 2) continue;
          const other1 = first.a === ep1.p ? first.b : first.a;
          const other2 = second.a === ep2.p ? second.b : second.a;
          const direction1 = subtract(ep1.p, other1), direction2 = subtract(ep2.p, other2);
          const gap = subtract(ep2.p, ep1.p);
          const length1 = Math.hypot(...direction1), length2 = Math.hypot(...direction2);
          if ((direction1[0] * gap[0] + direction1[1] * gap[1]) / (length1 * d) < minAlignment ||
              (direction2[0] * -gap[0] + direction2[1] * -gap[1]) / (length2 * d) < minAlignment) continue;
          const key = [ep1.p, ep2.p].map((p) => p.map((v) => Math.round(v * 10)).join(",")).sort().join("|");
          if (!added.has(key)) {
            added.add(key);
            bridges.push({ a: ep1.p, b: ep2.p });
          }
        }
      }
    }
  });
  return bridges.length ? [...input, ...bridges] : input;
}

export async function reconstructFaces(input, tolerance = 0.22, options = {}) {
  const maxGap = options?.maxGap || (options?.deepScan ? 4.0 : 1.4);
  const effectiveTol = options?.deepScan ? Math.max(tolerance, 0.32) : tolerance;
  const bridged = bridgeDashedSegments(input, maxGap);
  const segments = bridged.map((segment) => ({ ...segment, cuts: [0, 1] }));
  const grid = new Map();
  const cellSize = 24;
  let comparisons = 0;
  let cutCount = segments.length * 2;
  for (let i = 0; i < segments.length; i += 1) {
    if (i % 150 === 0) await yieldToBrowser();
    const line = segments[i];
    const nearby = new Set();
    const keys = [];
    const searchMargin = Math.max(tolerance, 1.4);
    const minX = Math.floor((Math.min(line.a[0], line.b[0]) - searchMargin) / cellSize);
    const maxX = Math.floor((Math.max(line.a[0], line.b[0]) + searchMargin) / cellSize);
    const minY = Math.floor((Math.min(line.a[1], line.b[1]) - searchMargin) / cellSize);
    const maxY = Math.floor((Math.max(line.a[1], line.b[1]) + searchMargin) / cellSize);
    if ((maxX - minX + 1) * (maxY - minY + 1) > 20000) throw new Error("PDF drawing coordinates are too large to process.");
    for (let x = minX; x <= maxX; x += 1) for (let y = minY; y <= maxY; y += 1) {
      const key = `${x},${y}`; keys.push(key);
      for (const index of grid.get(key) || []) nearby.add(index);
    }
    for (const index of nearby) {
      comparisons += 1;
      if (comparisons > 3000000) throw new Error("The PDF linework is too dense for automatic lot detection. Use a simpler site-plan page.");
      const previousCuts = line.cuts.length + segments[index].cuts.length;
      splitPair(line, segments[index], effectiveTol);
      cutCount += line.cuts.length + segments[index].cuts.length - previousCuts;
      if (cutCount > 200000) throw new Error("Too many intersecting lines to reconstruct safely. Use a simpler site-plan page.");
    }
    for (const key of keys) {
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(i);
    }
  }
  const vertices = [];
  const vertexGrid = new Map();
  const vertexFor = (point) => {
    const x = Math.floor(point[0] / effectiveTol); const y = Math.floor(point[1] / effectiveTol);
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) {
      for (const index of vertexGrid.get(`${x + dx},${y + dy}`) || []) {
        if (Math.hypot(...subtract(point, vertices[index].point)) <= effectiveTol) return index;
      }
    }
    const index = vertices.length;
    vertices.push({ point, neighbors: new Set() });
    const key = `${x},${y}`;
    if (!vertexGrid.has(key)) vertexGrid.set(key, []);
    vertexGrid.get(key).push(index);
    return index;
  };
  for (const line of segments) {
    line.cuts.sort((a, b) => a - b);
    for (let i = 1; i < line.cuts.length; i += 1) {
      const a = vertexFor(interpolate(line.a, line.b, line.cuts[i - 1]));
      const b = vertexFor(interpolate(line.a, line.b, line.cuts[i]));
      if (a !== b) { vertices[a].neighbors.add(b); vertices[b].neighbors.add(a); }
    }
  }
  for (const vertex of vertices) vertex.neighbors = [...vertex.neighbors].sort((a, b) =>
    Math.atan2(vertices[a].point[1] - vertex.point[1], vertices[a].point[0] - vertex.point[0]) -
    Math.atan2(vertices[b].point[1] - vertex.point[1], vertices[b].point[0] - vertex.point[0]));
  const visited = new Set();
  const faces = [];
  for (let start = 0; start < vertices.length; start += 1) {
    if (start % 500 === 0) await yieldToBrowser();
    for (const next of vertices[start].neighbors) {
      if (visited.has(`${start}:${next}`)) continue;
      const ring = [];
      let a = start; let b = next; let closed = false;
      for (let steps = 0; steps < 3000; steps += 1) {
        const key = `${a}:${b}`;
        if (visited.has(key)) { closed = a === start && b === next; break; }
        visited.add(key); ring.push(a);
        const neighbors = vertices[b].neighbors;
        const successor = neighbors[(neighbors.indexOf(a) - 1 + neighbors.length) % neighbors.length];
        a = b; b = successor;
      }
      const rawPoints = ring.map((index) => vertices[index].point);
      const points = cleanPolygonSpurs(rawPoints);
      // The opposite winding is the unbounded exterior face. Non-simple faces are
      // retained for block-label topology; the importer does not offer them as lots.
      if (closed && points.length >= 3 && points.length <= 500 && signedArea(points) > 2) {
        faces.push(points);
      }
    }
  }
  return faces;
}

export function cleanPolygonSpurs(points) {
  if (!points || points.length < 3) return points || [];
  let ring = [];
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length];
    if (Math.hypot(points[i][0] - next[0], points[i][1] - next[1]) > 0.0001) {
      ring.push(points[i]);
    }
  }
  let changed = true;
  while (changed && ring.length >= 3) {
    changed = false;
    for (let i = 0; i < ring.length; i += 1) {
      const prev = ring[(i - 1 + ring.length) % ring.length];
      const next = ring[(i + 1) % ring.length];
      if (Math.hypot(prev[0] - next[0], prev[1] - next[1]) < 0.0001) {
        const prevIdx = (i - 1 + ring.length) % ring.length;
        if (prevIdx < i) {
          ring.splice(i, 1);
          ring.splice(prevIdx, 1);
        } else {
          ring.splice(prevIdx, 1);
          ring.splice(i, 1);
        }
        changed = true;
        break;
      }
    }
  }
  return ring;
}
