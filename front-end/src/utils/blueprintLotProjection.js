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

export function overlayToSourcePoint([overlayU, overlayV], source, rotation = 0) {
  const crop = source?.cropBounds || { minX: 0, minY: 0, width: 100, height: 100 };
  const width = source?.imageWidth || 1000;
  const height = source?.imageHeight || 1000;
  const rawWidth = source?.cropBounds ? Math.max(10, Math.round(width * crop.width / 100)) : width;
  const rawHeight = source?.cropBounds ? Math.max(10, Math.round(height * crop.height / 100)) : height;

  const angle = (rotation || 0) * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotatedWidth = Math.max(10, Math.floor(rawWidth * Math.abs(cos) + rawHeight * Math.abs(sin)));
  const rotatedHeight = Math.max(10, Math.floor(rawWidth * Math.abs(sin) + rawHeight * Math.abs(cos)));

  const rx = (overlayU - 0.5) * rotatedWidth;
  const ry = (overlayV - 0.5) * rotatedHeight;

  const x = rx * cos + ry * sin;
  const y = -rx * sin + ry * cos;

  const renderW = source?.renderWidth || width;
  const renderH = source?.renderHeight || height;

  const u = (x + width * crop.minX / 100 + rawWidth / 2) / renderW;
  const v = (y + height * crop.minY / 100 + rawHeight / 2) / renderH;

  return [u, v];
}

export function projectBlueprintPointToLatLng([u, v], source, bounds, rotation, map) {
  if (!map || !bounds || !source) return null;
  const [overlayU, overlayV] = sourcePointToOverlay([u, v], source, rotation);
  const northwest = map.project([bounds[1][0], bounds[0][1]], 20);
  const southeast = map.project([bounds[0][0], bounds[1][1]], 20);
  const location = map.unproject([
    northwest.x + overlayU * (southeast.x - northwest.x),
    northwest.y + overlayV * (southeast.y - northwest.y),
  ], 20);
  return [location.lat, location.lng];
}

export function projectLatLngToBlueprintPoint([lat, lng], source, bounds, rotation = 0, map) {
  if (!map || !bounds || !source) return null;
  const northwest = map.project([bounds[1][0], bounds[0][1]], 20);
  const southeast = map.project([bounds[0][0], bounds[1][1]], 20);
  const pt = map.project([lat, lng], 20);

  const denomX = southeast.x - northwest.x;
  const denomY = southeast.y - northwest.y;
  if (Math.abs(denomX) < 1e-6 || Math.abs(denomY) < 1e-6) return null;

  const overlayU = (pt.x - northwest.x) / denomX;
  const overlayV = (pt.y - northwest.y) / denomY;

  return overlayToSourcePoint([overlayU, overlayV], source, rotation);
}

export function calculateMapViewportFromReview(reviewViewport, source, bounds, rotation, map) {
  if (!reviewViewport || !source || !bounds || !map) return null;

  const { centerX, centerY, viewWidthNorm, viewHeightNorm, zoom } = reviewViewport;
  if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) return null;

  const targetCenter = projectBlueprintPointToLatLng([centerX, centerY], source, bounds, rotation, map);
  if (!targetCenter || !Number.isFinite(targetCenter[0]) || !Number.isFinite(targetCenter[1])) {
    return null;
  }

  const effectiveZoom = Math.max(1, Number(zoom) || 1);
  const halfW = (Number.isFinite(viewWidthNorm) && viewWidthNorm > 0 ? viewWidthNorm : (1 / effectiveZoom)) / 2;
  const halfH = (Number.isFinite(viewHeightNorm) && viewHeightNorm > 0 ? viewHeightNorm : (1 / effectiveZoom)) / 2;

  const corners = [
    [centerX - halfW, centerY - halfH],
    [centerX + halfW, centerY - halfH],
    [centerX + halfW, centerY + halfH],
    [centerX - halfW, centerY + halfH],
  ];

  const geoCorners = corners
    .map((corner) => projectBlueprintPointToLatLng(corner, source, bounds, rotation, map))
    .filter((pt) => pt && Number.isFinite(pt[0]) && Number.isFinite(pt[1]));

  if (geoCorners.length < 4) return null;

  const lats = geoCorners.map((p) => p[0]);
  const lngs = geoCorners.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const visibleBounds = [[minLat, minLng], [maxLat, maxLng]];

  let targetZoom = map.getBoundsZoom(visibleBounds, false);
  const minZoom = map.getMinZoom?.() ?? 1;
  const maxZoom = map.getMaxZoom?.() ?? 28;
  targetZoom = Math.max(minZoom, Math.min(maxZoom, targetZoom));

  return {
    center: targetCenter,
    zoom: targetZoom,
    bounds: visibleBounds,
  };
}

export function calculateReviewViewportFromMap(map, source, bounds, rotation = 0) {
  if (!map || !source || !bounds) return null;
  const center = map.getCenter();
  const blueprintPoint = projectLatLngToBlueprintPoint([center.lat, center.lng], source, bounds, rotation, map);
  if (!blueprintPoint) return null;

  const [u, v] = blueprintPoint;
  if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
  if (u < -0.2 || u > 1.2 || v < -0.2 || v > 1.2) return null;

  const clampedU = Math.max(0.01, Math.min(0.99, u));
  const clampedV = Math.max(0.01, Math.min(0.99, v));

  let zoomFactor = 1;
  try {
    const baseZoom = map.getBoundsZoom(bounds, false);
    const currentZoom = map.getZoom();
    zoomFactor = Math.pow(2, currentZoom - baseZoom);
  } catch (e) {
    zoomFactor = 1;
  }
  const clampedZoom = Math.max(1, Math.min(24, zoomFactor));

  return {
    centerX: clampedU,
    centerY: clampedV,
    zoom: clampedZoom,
    isCustomView: clampedZoom > 1.05 || Math.abs(clampedU - 0.5) > 0.05 || Math.abs(clampedV - 0.5) > 0.05,
  };
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
