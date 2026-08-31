/**
 * geoUtils.js
 * Comprehensive geometry and lot positioning helper utilities for Golden Dragon Estate Platform
 */

/**
 * Calculates real-world geodesic surface area of a polygon coordinates array in square meters (SQM)
 * Uses the spherical excess method on WGS84 earth sphere (radius ~6378137m)
 * @param {Array<[number, number]>} coords - Array of [lat, lng] pairs
 * @returns {number} Area in square meters (rounded to 2 decimal places)
 */
export function calculateGeodesicArea(coords) {
  if (!coords || !Array.isArray(coords) || coords.length < 3) return 0;

  const RADIUS = 6378137; // Earth's mean radius in meters
  let total = 0;
  const len = coords.length;

  for (let i = 0; i < len; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % len];

    const lat1 = (p1[0] * Math.PI) / 180;
    const lat2 = (p2[0] * Math.PI) / 180;
    const lng1 = (p1[1] * Math.PI) / 180;
    const lng2 = (p2[1] * Math.PI) / 180;

    total += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  const area = Math.abs((total * RADIUS * RADIUS) / 2.0);
  return Math.round(area * 100) / 100;
}

/**
 * Intelligently increments lot names/numbers.
 * Examples:
 *   "BLOCK 1 Lot 2" -> "BLOCK 1 Lot 3"
 *   "Block 5 Lot 9" -> "Block 5 Lot 10"
 *   "Lot 15" -> "Lot 16"
 *   "B2-L04" -> "B2-L05"
 *   "14" -> "15"
 * @param {string} lotNumber - Original lot identifier
 * @returns {string} Incremented lot identifier
 */
export function autoIncrementLotNumber(lotNumber) {
  if (!lotNumber || typeof lotNumber !== "string") return "Lot 2";

  const trimmed = lotNumber.trim();

  // Pattern: "Block X Lot Y" or "BLOCK X LOT Y" or "Blk X Lot Y"
  const blockLotMatch = trimmed.match(/^(.*?(?:block|blk)\s*\d+\s*(?:lot|l)?\s*)(\d+)(.*)$/i);
  if (blockLotMatch) {
    const prefix = blockLotMatch[1];
    const currentNum = parseInt(blockLotMatch[2], 10);
    const suffix = blockLotMatch[3] || "";
    const padLength = blockLotMatch[2].length;
    const nextNumStr = (currentNum + 1).toString().padStart(padLength, "0");
    return `${prefix}${nextNumStr}${suffix}`;
  }

  // Pattern: "Lot X" or "LOT X" or "Lot-X"
  const lotMatch = trimmed.match(/^(.*?(?:lot|l)[\s\-_]*)(\d+)(.*)$/i);
  if (lotMatch) {
    const prefix = lotMatch[1];
    const currentNum = parseInt(lotMatch[2], 10);
    const suffix = lotMatch[3] || "";
    const padLength = lotMatch[2].length;
    const nextNumStr = (currentNum + 1).toString().padStart(padLength, "0");
    return `${prefix}${nextNumStr}${suffix}`;
  }

  // Pattern: Trailing numbers e.g. "Commercial-1" -> "Commercial-2"
  const trailingNumMatch = trimmed.match(/^(.*?)(\d+)$/);
  if (trailingNumMatch) {
    const prefix = trailingNumMatch[1];
    const currentNum = parseInt(trailingNumMatch[2], 10);
    const padLength = trailingNumMatch[2].length;
    const nextNumStr = (currentNum + 1).toString().padStart(padLength, "0");
    return `${prefix}${nextNumStr}`;
  }

  // If text without numbers (e.g. "EX", "Lot"), append number 2
  return `${trimmed} 2`;
}

/**
 * Finds the next available/unused lot identifier across a list of existing lots.
 * Continuously increments until an unused identifier is found.
 * @param {string} baseNumber - Base lot identifier
 * @param {Array<Object|string>} existingLots - Existing lots to check against
 * @returns {string} First available lot identifier
 */
export function getUnusedLotNumber(baseNumber, existingLots = []) {
  const taken = new Set(
    existingLots
      .map((l) => (typeof l === "string" ? l : l?.lot_number || "").trim().toLowerCase())
      .filter(Boolean)
  );

  let candidate = autoIncrementLotNumber(baseNumber);
  let safetyCounter = 0;
  while (taken.has(candidate.trim().toLowerCase()) && safetyCounter < 1000) {
    candidate = autoIncrementLotNumber(candidate);
    safetyCounter++;
  }
  return candidate;
}

/**
 * Finds the closest candidate vertex across all existing lots within a pixel threshold
 * @param {[number, number]} targetLatLng - Current drag point [lat, lng]
 * @param {Array<Object>} allLots - List of all lots in the property
 * @param {number|string} currentEditingLotId - Current lot id to exclude
 * @param {Object} leafletMap - Leaflet map instance
 * @param {number} thresholdPixels - Maximum distance in screen pixels to trigger snap (default: 14)
 * @returns {[number, number]|null} The snapped [lat, lng] or null
 */
export function findSnapVertex(targetLatLng, allLots, currentEditingLotId, leafletMap, thresholdPixels = 14) {
  if (!targetLatLng || !allLots || !leafletMap) return null;

  const targetPoint = leafletMap.latLngToContainerPoint(targetLatLng);
  let closestSnap = null;
  let minDistance = thresholdPixels;

  for (const lot of allLots) {
    if (Number(lot.lot_id) === Number(currentEditingLotId)) continue;
    if (!lot.coordinates || !Array.isArray(lot.coordinates)) continue;

    const coords =
      typeof lot.coordinates === "string" ? JSON.parse(lot.coordinates) : lot.coordinates;

    if (!Array.isArray(coords)) continue;

    for (const [lat, lng] of coords) {
      if (typeof lat !== "number" || typeof lng !== "number") continue;
      const point = leafletMap.latLngToContainerPoint([lat, lng]);
      const dist = Math.hypot(point.x - targetPoint.x, point.y - targetPoint.y);

      if (dist < minDistance) {
        minDistance = dist;
        closestSnap = [lat, lng];
      }
    }
  }

  return closestSnap;
}

/**
 * Generates an adjacent shifted polygon along the right/longitude edge
 * @param {Array<[number, number]>} coords - Existing polygon coordinates
 * @returns {Array<[number, number]>} Cloned and shifted coordinates
 */
export function offsetPolygonAdjacent(coords) {
  if (!coords || !Array.isArray(coords) || coords.length === 0) return coords;

  // Calculate width in longitude and height in latitude of existing lot
  const lngs = coords.map((c) => c[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const widthLng = maxLng - minLng;

  // Shift directly to the right by (width + tiny gap or exact width)
  const offsetLng = widthLng > 0 ? widthLng : 0.00015;

  return coords.map(([lat, lng]) => [lat, lng + offsetLng]);
}
