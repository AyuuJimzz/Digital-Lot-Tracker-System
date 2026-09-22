/**
 * High-performance Satellite Tile Preloader for Golden Dragon Estate Platform.
 * Converts coordinates to Spherical Mercator tile coordinates and pre-caches
 * satellite imagery into browser HTTP cache with bounded background requests.
 */

function latLngToTile(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const rad = (lat * Math.PI) / 180;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return { x, y, z: zoom };
}

function getTileUrl(x, y, z, layer = "satellite") {
  const sub = ["mt0", "mt1", "mt2", "mt3"][(x + y) % 4];
  if (layer === "streets") {
    return `https://${sub}.google.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}`;
  }
  if (layer === "hybrid") {
    return `https://${sub}.google.com/vt/lyrs=y&x=${x}&y=${y}&z=${z}`;
  }
  return `https://${sub}.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${z}`;
}

const preloadedUrls = new Set();
const requests = new Map();
let activeRequests = 0;

function pumpPreloads() {
  for (const [url, request] of requests) {
    if (activeRequests >= 4) break;
    if (request.active) continue;
    startPreload(url, request);
  }
}

function startPreload(url, request) {
  request.active = true;
  activeRequests++;
  const img = new Image();
  request.image = img;
  let settled = false;
  const finish = (loaded) => {
    if (settled) return;
    settled = true;
    clearTimeout(request.timeout);
    img.onload = img.onerror = null;
    requests.delete(url);
    activeRequests--;
    if (loaded) {
      preloadedUrls.add(url);
      if (preloadedUrls.size > 512) preloadedUrls.delete(preloadedUrls.values().next().value);
    }
    pumpPreloads();
  };
  img.decoding = "async";
  img.fetchPriority = "low";
  img.onload = () => finish(true);
  img.onerror = () => finish(false);
  request.timeout = setTimeout(() => {
    img.src = "";
    finish(false);
  }, 8000);
  img.src = url;
}

/**
 * Preload a tile grid around a specific [lat, lng] at specified zoom levels.
 * Visible map requests take priority over this small background queue.
 */
export function preloadLocationTiles(lat, lng, zooms = [16, 17, 18, 19], layer = "satellite", tileRadius = 2) {
  if (typeof window === "undefined" || !Number.isFinite(lat) || !Number.isFinite(lng) ||
      Math.abs(lat) > 85.05112878 || Math.abs(lng) > 180) return () => {};
  const radius = Number.isFinite(tileRadius) ? Math.max(0, Math.min(3, Math.floor(tileRadius))) : 1;
  const owner = Symbol("preload");
  const urls = [];

  [...new Set(zooms)].filter((zoom) => Number.isInteger(zoom) && zoom >= 0 && zoom <= 20).forEach((zoom) => {
    const center = latLngToTile(lat, lng, zoom);
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const size = 2 ** zoom;
        const x = ((center.x + dx) % size + size) % size;
        const y = center.y + dy;
        if (y < 0 || y >= size) continue;
        const url = getTileUrl(x, y, zoom, layer);

        if (!preloadedUrls.has(url)) {
          if (!requests.has(url)) requests.set(url, { active: false, owners: new Set() });
          requests.get(url).owners.add(owner);
          urls.push(url);
        }
      }
    }
  });
  pumpPreloads();
  // A new destination drops queued old tiles; at most two in-flight downloads
  // finish in the background. Failed downloads can be retried on the next visit.
  return () => {
    urls.forEach((url) => {
      const request = requests.get(url);
      if (!request) return;
      request.owners.delete(owner);
      if (!request.active && !request.owners.size) requests.delete(url);
    });
  };
}

/**
 * Preload regional overview tiles (Zoom 12-13) covering the estate region.
 * This guarantees satellite imagery is cached in the browser when the camera
 * zooms out to cruise altitude during long-distance flights.
 */
export function preloadRegionalOverviewTiles(properties = [], layer = "satellite") {
  let centerLat = 10.7;
  let centerLng = 122.45;
  if (Array.isArray(properties) && properties.length > 0) {
    const valid = properties.filter(
      (p) => p && p.coordinates && Array.isArray(p.coordinates) && p.coordinates.length >= 2 &&
        Number.isFinite(p.coordinates[0]) && Number.isFinite(p.coordinates[1])
    );
    if (valid.length > 0) {
      const lats = valid.map((p) => p.coordinates[0]);
      const lngs = valid.map((p) => p.coordinates[1]);
      centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    }
  }
  return preloadLocationTiles(centerLat, centerLng, [12, 13], layer, 3);
}

