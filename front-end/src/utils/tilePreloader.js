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
 * Preload 5x5 tile grid around a specific [lat, lng] at specified zoom levels
 * Covers the entire estate perimeter so every lot tile is instant
 */
export function preloadLocationTiles(lat, lng, zooms = [16, 17, 18, 19], layer = "satellite") {
  if (typeof window === "undefined" || !lat || !lng) return;

  const runPreload = () => {
    zooms.forEach((zoom) => {
      const center = latLngToTile(lat, lng, zoom);
      // Preload 5x5 surrounding grid to cover wide estates
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
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

  runPreload();
}

/**
 * Eagerly preload all properties in fast succession on load
 */
export function preloadAllProperties(properties = [], layer = "satellite") {
  if (!properties || properties.length === 0) return;

  const queue = properties.filter(
    (p) => p.coordinates && Array.isArray(p.coordinates) && p.coordinates.length >= 2
  );

  queue.forEach((prop, idx) => {
    setTimeout(() => {
      preloadLocationTiles(prop.coordinates[0], prop.coordinates[1], [16, 17, 18, 19], layer);
    }, idx * 150);
  });
}
