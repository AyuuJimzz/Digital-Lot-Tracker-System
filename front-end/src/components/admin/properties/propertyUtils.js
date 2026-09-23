import { geocodeAddress } from "../../../utils/geocoding";

export const MUNICIPALITY_COORDINATES = {
  "barotac nuevo": [10.8906, 122.7042],
  "barotac": [10.8906, 122.7042],
  "oton": [10.7372, 122.4998],
  "guimbal": [10.6713, 122.3353],
  "nanga": [10.6713, 122.3353],
  "pavia": [10.7744, 122.5408],
  "santa barbara": [10.8242, 122.5342],
  "leganes": [10.7833, 122.5833],
  "dumangas": [10.8250, 122.7167],
  "zarraga": [10.8217, 122.6108],
  "pototan": [10.9472, 122.6289],
  "janiuay": [10.9575, 122.5022],
  "miagao": [10.6444, 122.2358],
  "san joaquin": [10.5878, 122.1408],
  "tigbauan": [10.6756, 122.3811],
  "iloilo": [10.7202, 122.5621],
  "passi": [11.1075, 122.6419],
};

/**
 * Resolves GPS coordinates for a property using the municipality dictionary
 * or falling back to dynamic address geocoding.
 */
export async function resolvePropertyCoordinates(location, propertyName) {
  let resolvedCoords = null;

  // 1. Instant match with known town dictionary
  const locationText = `${location || ""} ${propertyName || ""}`.toLowerCase();
  for (const [key, coords] of Object.entries(MUNICIPALITY_COORDINATES)) {
    if (locationText.includes(key)) {
      resolvedCoords = coords;
      break;
    }
  }

  // 2. Dynamic geocoding if not found in town dictionary
  if (!resolvedCoords && location) {
    try {
      const geo = await geocodeAddress(location);
      if (geo && geo.lat && geo.lng) {
        resolvedCoords = [geo.lat, geo.lng];
      }
    } catch (geoErr) {
      console.warn("Geocoding notice:", geoErr);
    }
  }

  return resolvedCoords;
}
