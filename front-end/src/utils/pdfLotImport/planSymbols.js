// A numbered circle is a block annotation, not a curved parcel. Parcel curves
// elsewhere in the drawing must remain in the topology.
export function resolveBlockSymbols(segments, labels) {
  const paths = new Map();
  for (const segment of segments) {
    if (segment.pathId == null) continue;
    if (!paths.has(segment.pathId)) paths.set(segment.pathId, []);
    paths.get(segment.pathId).push(segment);
  }
  const symbols = [];
  for (const [pathId, path] of paths) {
    if (path.length < 10 || !path.some((segment) => segment.curved)) continue;
    const first = path[0].a, last = path[path.length - 1].b;
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) > 0.3) continue;
    const points = path.map((segment) => segment.a);
    const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
    const width = Math.max(...xs) - Math.min(...xs), height = Math.max(...ys) - Math.min(...ys);
    if (width < 4 || width > 40 || Math.abs(width / height - 1) > 0.08) continue;
    const center = [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2];
    const radius = (width + height) / 4;
    if (points.some((p) => Math.abs(Math.hypot(p[0] - center[0], p[1] - center[1]) / radius - 1) > 0.08)) continue;
    const numbers = labels.filter((label) => Number.isInteger(label.bareValue) && label.bareValue > 0 && label.bareValue < 1000 &&
      Math.hypot(label.point[0] - center[0], label.point[1] - center[1]) < radius * 0.65);
    if (numbers.length !== 1) continue;
    const label = numbers[0];
    label.block = String(label.bareValue);
    label.blockSymbol = true;
    label.symbolRadius = radius;
    label.lotNumber = "";
    symbols.push({ pathId, center, radius });
  }
  const removed = new Set(symbols.map((symbol) => symbol.pathId));
  const result = segments.filter((segment) => !removed.has(segment.pathId)).map((segment) => ({ ...segment }));
  let restored = 0;
  for (const symbol of symbols) {
    const incident = [];
    for (const segment of result) {
      if (segment.curved) continue;
      for (const endpoint of ["a", "b"]) {
        const other = segment[endpoint === "a" ? "b" : "a"];
        const point = segment[endpoint];
        const toward = [symbol.center[0] - point[0], symbol.center[1] - point[1]];
        const distance = Math.hypot(...toward);
        const direction = [point[0] - other[0], point[1] - other[1]];
        const length = Math.hypot(...direction);
        if (Math.abs(distance - symbol.radius) > 0.65 || length < 0.5) continue;
        // Only continue a boundary aimed at the marker's centre; never join
        // unrelated nearby endpoints or extend a tangent into a fictitious lot.
        const perpendicular = Math.abs(direction[0] * toward[1] - direction[1] * toward[0]) / length;
        const forward = (direction[0] * toward[0] + direction[1] * toward[1]) / length;
        if (perpendicular <= Math.max(0.45, symbol.radius * 0.25) && forward > 0) {
          incident.push({ segment, endpoint, point, normal: [-direction[1] / length, direction[0] / length] });
        }
      }
    }
    if (incident.length < 2) continue;
    // Fit the intersection of the printed lines. The annotation circle can be
    // off-centre; using its centre directly would bend otherwise straight lots.
    let xx = 0, xy = 0, yy = 0, bx = 0, by = 0;
    for (const { normal: [x, y], point } of incident) {
      const offset = x * (point[0] - symbol.center[0]) + y * (point[1] - symbol.center[1]);
      xx += x * x; xy += x * y; yy += y * y; bx += x * offset; by += y * offset;
    }
    const determinant = xx * yy - xy * xy;
    const junction = determinant > 0.01 ? [symbol.center[0] + (yy * bx - xy * by) / determinant,
      symbol.center[1] + (xx * by - xy * bx) / determinant] :
      incident.reduce((sum, { point }) => [sum[0] + point[0] / incident.length, sum[1] + point[1] / incident.length], [0, 0]);
    if (Math.hypot(junction[0] - symbol.center[0], junction[1] - symbol.center[1]) > symbol.radius * 0.5 ||
      incident.some(({ point, normal: [x, y] }) => Math.abs(x * (junction[0] - point[0]) + y * (junction[1] - point[1])) > 0.65)) continue;
    for (const { segment, endpoint } of incident) {
      segment[endpoint] = junction;
      segment.restoredAtSymbol = true;
      restored += 1;
    }
  }
  return { segments: result, symbols, restored };
}

// Read a stacked pair in its own text orientation. 80/91/98 can be areas;
// their meaning cannot be determined by a global numeric cutoff.
export function pairNumericLabels(labels) {
  const bare = labels.filter((label) => label.bareValue > 0 && !label.blockSymbol && !label.lotNumber && !label.block);
  const options = [];
  for (const lot of bare) {
    if (!Number.isInteger(lot.bareValue) || lot.bareValue > 999) continue;
    const size = lot.height || 8;
    const down = lot.down || [0, 1];
    for (const area of bare) {
      if (area === lot || area.bareValue < 10 || area.bareValue > 10000000) continue;
      const delta = [area.point[0] - lot.point[0], area.point[1] - lot.point[1]];
      const vertical = (delta[0] * down[0] + delta[1] * down[1]) / size;
      const horizontal = Math.abs(delta[0] * down[1] - delta[1] * down[0]) / size;
      if (vertical < 0.45 || vertical > 2 || horizontal > 0.7) continue;
      const otherDown = area.down || [0, 1];
      if (down[0] * otherDown[0] + down[1] * otherDown[1] < 0.9) continue;
      options.push({ lot, area, score: horizontal * 2 + Math.abs(vertical - 0.95) });
    }
  }
  options.sort((a, b) => a.score - b.score);
  const used = new Set(), pairs = [];
  for (const option of options) {
    if (used.has(option.lot) || used.has(option.area)) continue;
    used.add(option.lot); used.add(option.area); pairs.push(option);
  }
  if (pairs.length < 3) return [];
  pairs.forEach(({ lot, area }, index) => {
    lot.lotNumber = String(lot.bareValue);
    lot.numericPair = index;
    area.areaSqm = area.bareValue;
    area.numericPair = index;
  });
  return pairs;
}
