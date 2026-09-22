/**
 * Bounded tile warmup queue for the Golden Dragon Estate map.
 * High-priority cold-start work may use eight connections; background destination
 * warmups stay at four so visible Leaflet requests retain bandwidth.
 */

export function latLngToTile(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const rad = (lat * Math.PI) / 180;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return { x, y, z: zoom };
}

function getTileUrl(x, y, z, layer = "satellite") {
  const sub = ["mt0", "mt1", "mt2", "mt3"][Math.abs(x + y) % 4];
  if (layer === "streets") return `https://${sub}.google.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}`;
  if (layer === "hybrid") return `https://${sub}.google.com/vt/lyrs=y&x=${x}&y=${y}&z=${z}`;
  return `https://${sub}.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${z}`;
}

const PRIORITY = { low: 0, normal: 1, high: 2 };
const preloadedUrls = new Set();
const requests = new Map();
let activeRequests = 0;
let sequence = 0;

function finishRequest(url, request, loaded) {
  if (request.settled) return;
  request.settled = true;
  clearTimeout(request.timeout);
  if (request.image) request.image.onload = request.image.onerror = null;
  requests.delete(url);
  if (request.active) activeRequests--;
  if (loaded) {
    preloadedUrls.add(url);
    if (preloadedUrls.size > 768) preloadedUrls.delete(preloadedUrls.values().next().value);
  }
  request.resolve(loaded);
  pumpPreloads();
}

function startPreload(url, request) {
  request.active = true;
  activeRequests++;
  const img = new Image();
  request.image = img;
  img.decoding = "async";
  img.fetchPriority = request.priority >= PRIORITY.high ? "high" : "low";
  img.onload = () => finishRequest(url, request, true);
  img.onerror = () => finishRequest(url, request, false);
  request.timeout = setTimeout(() => {
    img.src = "";
    finishRequest(url, request, false);
  }, request.priority >= PRIORITY.high ? 5000 : 8000);
  img.src = url;
}

function pumpPreloads() {
  const queued = [...requests.entries()]
    .filter(([, request]) => !request.active)
    .sort((a, b) => b[1].priority - a[1].priority || a[1].sequence - b[1].sequence);
  const hasUrgentWork = queued.some(([, request]) => request.priority >= PRIORITY.high);
  const limit = hasUrgentWork ? 8 : 4;
  for (const [url, request] of queued) {
    if (activeRequests >= limit) break;
    startPreload(url, request);
  }
}

function enqueue(url, owner, priority) {
  if (preloadedUrls.has(url)) return Promise.resolve(true);
  let request = requests.get(url);
  if (!request) {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    request = { active: false, owners: new Set(), priority, sequence: sequence++, promise, resolve };
    requests.set(url, request);
  } else if (priority > request.priority) {
    request.priority = priority;
    if (request.image) request.image.fetchPriority = "high";
  }
  request.owners.add(owner);
  return request.promise;
}

function queueUrls(urls, priorityName) {
  const owner = Symbol("tile-preload");
  const priority = PRIORITY[priorityName] ?? PRIORITY.low;
  const uniqueUrls = [...new Set(urls)];
  const ready = Promise.all(uniqueUrls.map((url) => enqueue(url, owner, priority)))
    .then((results) => results.every(Boolean));
  pumpPreloads();
  const cancel = () => {
    uniqueUrls.forEach((url) => {
      const request = requests.get(url);
      if (!request) return;
      request.owners.delete(owner);
      if (!request.owners.size) {
        if (request.active && request.image) request.image.src = "";
        finishRequest(url, request, false);
      }
    });
  };
  cancel.ready = ready;
  return cancel;
}

function tileGridUrls(lat, lng, zooms, layer, tileRadius) {
  const urls = [];
  const radius = Number.isFinite(tileRadius) ? Math.max(0, Math.min(3, Math.floor(tileRadius))) : 1;
  [...new Set(zooms)].filter((zoom) => Number.isInteger(zoom) && zoom >= 0 && zoom <= 20).forEach((zoom) => {
    const center = latLngToTile(lat, lng, zoom);
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const size = 2 ** zoom;
        const x = ((center.x + dx) % size + size) % size;
        const y = center.y + dy;
        if (y >= 0 && y < size) urls.push(getTileUrl(x, y, zoom, layer));
      }
    }
  });
  return urls;
}

export function preloadLocationTiles(lat, lng, zooms = [16, 17, 18, 19], layer = "satellite", tileRadius = 2, options = {}) {
  if (typeof window === "undefined" || !Number.isFinite(lat) || !Number.isFinite(lng) ||
      Math.abs(lat) > 85.05112878 || Math.abs(lng) > 180) return Object.assign(() => {}, { ready: Promise.resolve(false) });
  return queueUrls(tileGridUrls(lat, lng, zooms, layer, tileRadius), options.priority || "low");
}

function lineTiles(from, to) {
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  if (!steps) return [{ x: from.x, y: from.y, z: from.z }];
  const result = [];
  for (let index = 0; index <= steps; index++) {
    result.push({
      x: Math.round(from.x + ((to.x - from.x) * index) / steps),
      y: Math.round(from.y + ((to.y - from.y) * index) / steps),
      z: from.z,
    });
  }
  return result;
}

export function getFlightCorridorTileUrls(properties = [], layer = "satellite") {
  const points = properties
    .filter((property) => Array.isArray(property?.coordinates) && property.coordinates.length >= 2 &&
      Number.isFinite(property.coordinates[0]) && Number.isFinite(property.coordinates[1]))
    .map((property) => property.coordinates)
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  if (!points.length) points.push([10.7, 122.45]);

  const macro = new Set();
  const overview = new Set();
  const addPath = (zoom, target, radius) => {
    const tiled = points.map(([lat, lng]) => latLngToTile(lat, lng, zoom));
    const paths = tiled.length === 1 ? tiled : tiled.slice(1).flatMap((point, index) => lineTiles(tiled[index], point));
    paths.forEach((tile) => {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          target.add(getTileUrl(tile.x + dx, tile.y + dy, zoom, layer));
        }
      }
    });
  };
  addPath(8, macro, 0);
  addPath(12, overview, 1);
  addPath(13, overview, 1);
  return { macro: [...macro], overview: [...overview].slice(0, 96) };
}

/** Warm the permanent z8 parents first, then the z12/z13 flight corridor. */
export function preloadFlightCorridorTiles(properties = [], layer = "satellite") {
  const { macro, overview } = getFlightCorridorTileUrls(properties, layer);
  const cancelMacro = queueUrls(macro, "high");
  const cancelOverview = queueUrls(overview, "high");
  const cancel = () => { cancelMacro(); cancelOverview(); };
  cancel.macroReady = cancelMacro.ready;
  cancel.ready = Promise.all([cancelMacro.ready, cancelOverview.ready]).then((values) => values.every(Boolean));
  cancel.corridorReady = cancel.ready;
  return cancel;
}

// Retained compatibility for callers outside the property navigation hook.
export function preloadRegionalOverviewTiles(properties = [], layer = "satellite") {
  return preloadFlightCorridorTiles(properties, layer);
}
