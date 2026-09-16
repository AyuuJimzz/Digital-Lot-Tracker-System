// Match the existing canvas crop/rotation, then Leaflet's projected image bounds.
// Rotating latitude/longitude directly would drift from the visible blueprint.
export function sourcePointToOverlay([u, v], source, rotation = 0) {
  const crop = source.cropBounds || { minX: 0, minY: 0, width: 100, height: 100 };
  const width = source.imageWidth;
  const height = source.imageHeight;
  const rawWidth = source.cropBounds ? Math.max(10, Math.round(width * crop.width / 100)) : width;
  const rawHeight = source.cropBounds ? Math.max(10, Math.round(height * crop.height / 100)) : height;
  const x = u * (source.renderWidth || width) - width * crop.minX / 100 - rawWidth / 2;
  const y = v * (source.renderHeight || height) - height * crop.minY / 100 - rawHeight / 2;
  const angle = rotation * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotatedWidth = Math.max(10, Math.floor(rawWidth * Math.abs(cos) + rawHeight * Math.abs(sin)));
  const rotatedHeight = Math.max(10, Math.floor(rawWidth * Math.abs(sin) + rawHeight * Math.abs(cos)));
  return [(x * cos - y * sin) / rotatedWidth + 0.5, (x * sin + y * cos) / rotatedHeight + 0.5];
}

export function projectLotCandidate(candidate, source, bounds, rotation, map) {
  const northwest = map.project([bounds[1][0], bounds[0][1]], 20);
  const southeast = map.project([bounds[0][0], bounds[1][1]], 20);
  return candidate.points.map((point) => {
    const [u, v] = sourcePointToOverlay(point, source, rotation);
    const location = map.unproject([
      northwest.x + u * (southeast.x - northwest.x),
      northwest.y + v * (southeast.y - northwest.y),
    ], 20);
    return [location.lat, location.lng];
  });
}

export function projectBlueprintRoadLabel(label, source, bounds, rotation, map) {
  if (!label?.point || !source || !bounds || !map) return null;
  const [originalU, originalV] = sourcePointToOverlay(label.point, source, 0);
  if (originalU < 0 || originalU > 1 || originalV < 0 || originalV > 1) return null;
  if (source.cropBounds?.polygon && !inPolygon(label.point, source.cropBounds.polygon)) return null;
  const [u, v] = sourcePointToOverlay(label.point, source, rotation);
  if (!Number.isFinite(u) || !Number.isFinite(v) || u < 0 || u > 1 || v < 0 || v > 1) return null;
  const northwest = map.project([bounds[1][0], bounds[0][1]], 20);
  const southeast = map.project([bounds[0][0], bounds[1][1]], 20);
  const location = map.unproject([
    northwest.x + u * (southeast.x - northwest.x),
    northwest.y + v * (southeast.y - northwest.y),
  ], 20);
  const angle = Number(label.rotation || 0) * Math.PI / 180;
  const aspect = label.pageAspect || (source.renderWidth || source.imageWidth) / (source.renderHeight || source.imageHeight);
  const delta = label.textHeight || 0.001;
  const [endU, endV] = sourcePointToOverlay([
    label.point[0] + Math.cos(angle) * delta / aspect,
    label.point[1] + Math.sin(angle) * delta,
  ], source, rotation);
  const dx = (endU - u) * (southeast.x - northwest.x);
  const dy = (endV - v) * (southeast.y - northwest.y);
  const visualRotation = Math.atan2(dy, dx) * 180 / Math.PI;
  return { ...label, lat: location.lat, lng: location.lng, rotation: visualRotation,
    fontSize: label.textHeight ? Math.max(1, Math.hypot(dx, dy) * 0.85) : (label.fontSize || 12),
    scaleWithMap: true };
}

function inPolygon([x, y], polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[j];
    const [bx, by] = polygon[i];
    const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
    if (Math.abs(cross) < 1e-8 && x >= Math.min(ax, bx) - 1e-8 && x <= Math.max(ax, bx) + 1e-8 && y >= Math.min(ay, by) - 1e-8 && y <= Math.max(ay, by) + 1e-8) return true;
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

export function candidateInsideCrop(candidate, crop) {
  if (!crop) return true;
  const polygon = crop.polygon || [
    [crop.minX / 100, crop.minY / 100], [crop.maxX / 100, crop.minY / 100],
    [crop.maxX / 100, crop.maxY / 100], [crop.minX / 100, crop.maxY / 100],
  ];
  return candidate.points.every((point, i) => {
    const next = candidate.points[(i + 1) % candidate.points.length];
    return inPolygon(point, polygon) && inPolygon([(point[0] + next[0]) / 2, (point[1] + next[1]) / 2], polygon);
  });
}

export function importedLotIdentifier(candidate) {
  const lot = String(candidate.lotNumber || "").trim();
  const block = String(candidate.block || "").trim();
  let base = block ? `Block ${block} Lot ${lot}` : lot;

  // Preserve non-saleable category tag in the imported lot identifier
  if (candidate.category && candidate.category !== "residential" && candidate.category !== "saleable") {
    const label =
      candidate.category === "park" ? "Park & Playground" :
      candidate.category === "facility" ? "Community Facility" :
      candidate.category === "excluded" ? "Excluded Area" :
      candidate.category === "open_space" ? "Open Space" :
      (candidate.categoryLabel || "Non-Saleable");
    const lower = base.toLowerCase();
    if (!lower.includes(candidate.category.toLowerCase()) && !lower.includes(label.toLowerCase())) {
      base = `${base} (${label})`;
    }
  }

  return base;
}

// Reframe an already aligned PDF after choosing a different cutout from the
// original page. Work in map pixels so repeated crops and rotation do not drift.
export function reframeBlueprintCrop(source, nextCrop, bounds, rotation, map) {
  const dimensions = (crop) => {
    const width = crop ? Math.max(10, Math.round(source.imageWidth * crop.width / 100)) : source.imageWidth;
    const height = crop ? Math.max(10, Math.round(source.imageHeight * crop.height / 100)) : source.imageHeight;
    const angle = rotation * Math.PI / 180, cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle));
    return { width, height, rotatedWidth: Math.max(10, Math.floor(width * cos + height * sin)),
      rotatedHeight: Math.max(10, Math.floor(width * sin + height * cos)) };
  };
  const oldSize = dimensions(source.cropBounds), nextSize = dimensions(nextCrop);
  const center = [(nextCrop.minX / 100 * source.imageWidth + nextSize.width / 2) / (source.renderWidth || source.imageWidth),
    (nextCrop.minY / 100 * source.imageHeight + nextSize.height / 2) / (source.renderHeight || source.imageHeight)];
  const [u, v] = sourcePointToOverlay(center, source, rotation);
  const nw = map.project([bounds[1][0], bounds[0][1]], 20);
  const se = map.project([bounds[0][0], bounds[1][1]], 20);
  const xScale = (se.x - nw.x) / oldSize.rotatedWidth, yScale = (se.y - nw.y) / oldSize.rotatedHeight;
  const cx = nw.x + u * (se.x - nw.x), cy = nw.y + v * (se.y - nw.y);
  const frame = (width, height) => {
    const topLeft = map.unproject([cx - width * xScale / 2, cy - height * yScale / 2], 20);
    const bottomRight = map.unproject([cx + width * xScale / 2, cy + height * yScale / 2], 20);
    return [[bottomRight.lat, topLeft.lng], [topLeft.lat, bottomRight.lng]];
  };
  const unrotated = frame(nextSize.width, nextSize.height);
  return { bounds: frame(nextSize.rotatedWidth, nextSize.rotatedHeight),
    unrotatedSpan: { latSpan: unrotated[1][0] - unrotated[0][0], lngSpan: unrotated[1][1] - unrotated[0][1] } };
}
