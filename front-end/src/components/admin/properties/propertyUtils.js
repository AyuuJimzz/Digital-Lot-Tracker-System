import { geocodeAddress } from "../../../utils/geocoding";

export const MUNICIPALITY_COORDINATES = {
  // Specific Barangays & Cadastres
  "brgy. lambuyao": [10.7146, 122.4916],
  "brgy lambuyao": [10.7146, 122.4916],
  "lambuyao": [10.7146, 122.4916],
  "brgy. abilay norte": [10.7372, 122.4998],
  "brgy abilay norte": [10.7372, 122.4998],
  "abilay norte": [10.7372, 122.4998],
  "abilay": [10.7372, 122.4998],
  "brgy. nanga": [10.6713, 122.3353],
  "brgy nanga": [10.6713, 122.3353],
  "nanga": [10.6713, 122.3353],

  // Municipalities & Cities
  "barotac nuevo": [10.8906, 122.7042],
  "barotac": [10.8906, 122.7042],
  "oton": [10.7006, 122.4839],
  "guimbal": [10.6631, 122.3197],
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

const BROAD_TOWNS = new Set([
  "oton", "guimbal", "barotac", "pavia", "santa barbara",
  "leganes", "dumangas", "zarraga", "pototan", "janiuay",
  "miagao", "san joaquin", "tigbauan", "iloilo", "passi"
]);

/**
 * Resolves GPS coordinates for a property:
 * 1. Specific Barangay / Cadastre match (e.g. Lambuyao, Abilay Norte, Nanga)
 * 2. Dynamic geocoding via OpenStreetMap Nominatim for exact street/barangay
 * 3. Broad town / municipality center fallback (e.g. Oton Poblacion)
 */
export async function resolvePropertyCoordinates(location, propertyName) {
  let resolvedCoords = null;
  const locationText = `${location || ""} ${propertyName || ""}`.toLowerCase();

  // 1. Check specific barangays / subdivisions first (sorted by longest name first)
  const specificEntries = Object.entries(MUNICIPALITY_COORDINATES)
    .filter(([key]) => !BROAD_TOWNS.has(key))
    .sort(([a], [b]) => b.length - a.length);

  for (const [key, coords] of specificEntries) {
    if (locationText.includes(key)) {
      resolvedCoords = coords;
      return resolvedCoords;
    }
  }

  // 2. Dynamic online geocoding if no exact barangay was found locally
  if (location) {
    try {
      const geo = await geocodeAddress(location);
      if (geo && geo.lat && geo.lng) {
        return [geo.lat, geo.lng];
      }
    } catch (geoErr) {
      console.warn("Geocoding notice:", geoErr);
    }
  }

  // 3. Broad town / municipality fallback
  const broadEntries = Object.entries(MUNICIPALITY_COORDINATES)
    .filter(([key]) => BROAD_TOWNS.has(key))
    .sort(([a], [b]) => b.length - a.length);

  for (const [key, coords] of broadEntries) {
    if (locationText.includes(key)) {
      resolvedCoords = coords;
      return resolvedCoords;
    }
  }

  // 4. Default Iloilo center
  return [10.7202, 122.5621];
}
