const viewKey = (propertyId) => `propertyMapView_${propertyId}`;

export function loadPropertyMapView(propertyId) {
  if (propertyId == null) return null;
  try {
    const saved = JSON.parse(localStorage.getItem(viewKey(propertyId)) || "null");
    if (!saved || !Array.isArray(saved.center) || saved.center.length !== 2) return null;
    const [lat, lng] = saved.center;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 ||
      !Number.isFinite(saved.zoom) || saved.zoom < 1 || saved.zoom > 28) return null;
    return saved;
  } catch (_) {
    return null;
  }
}

export function savePropertyMapView(propertyId, map) {
  if (propertyId == null || !map) return;
  try {
    const center = map.getCenter();
    const zoom = map.getZoom();
    if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng) || !Number.isFinite(zoom)) return;
    localStorage.setItem(viewKey(propertyId), JSON.stringify({ center: [center.lat, center.lng], zoom }));
  } catch (_) {
    // Map navigation remains usable if browser storage is unavailable.
  }
}
