/**
 * High-performance Satellite Tile Preloader for Golden Dragon Estate Platform.
 * Converts coordinates to Spherical Mercator tile coordinates and pre-caches
 * satellite imagery into browser HTTP cache during idle moments.
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

/**
 * Preload 3x3 tile grid around a specific [lat, lng] at specified zoom levels
 */
export function preloadLocationTiles(lat, lng, zooms = [14, 18, 19], layer = "satellite") {
  if (typeof window === "undefined" || !lat || !lng) return;

  const runPreload = () => {
    zooms.forEach((zoom) => {
      const center = latLngToTile(lat, lng, zoom);
      // Preload 3x3 surrounding grid
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const x = center.x + dx;
          const y = center.y + dy;
          const url = getTileUrl(x, y, zoom, layer);

          if (!preloadedUrls.has(url)) {
            preloadedUrls.add(url);
            const img = new Image();
            img.decoding = "async";
            img.src = url;
          }
        }
      }
    });
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(runPreload, { timeout: 2000 });
  } else {
    setTimeout(runPreload, 200);
  }
}

/**
 * Preload all properties using requestIdleCallback chain
 * so preloading NEVER competes with active map rendering
 */
export function preloadAllProperties(properties = [], layer = "satellite") {
  if (!properties || properties.length === 0) return;

  // Chain idle callbacks — each property only loads when browser is truly idle
  const queue = properties.filter(
    (p) => p.coordinates && Array.isArray(p.coordinates) && p.coordinates.length >= 2
  );

  const processNext = (index) => {
    if (index >= queue.length) return;
    const prop = queue[index];
    const run = () => {
      preloadLocationTiles(prop.coordinates[0], prop.coordinates[1], [14, 18, 19], layer);
      processNext(index + 1);
    };
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(run, { timeout: 4000 });
    } else {
      setTimeout(run, index * 300);
    }
  };

  // Start the chain after a 1-second delay so map renders first
  setTimeout(() => processNext(0), 1000);
}
