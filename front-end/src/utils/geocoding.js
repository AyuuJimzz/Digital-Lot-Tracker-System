// front-end/src/utils/geocoding.js
import axios from "axios";

/**
 * ── Comprehensive Municipalities & Cities Coordinates Database ──
 * Covers all 43 LGUs of Iloilo Province, Iloilo City, Guimaras, and neighboring Panay/Negros hubs.
 * Provides instant 0-latency coordinates even with weak internet or offline signal.
 */
export const MUNICIPALITY_COORDINATES = {
  // ── Iloilo City & Districts ──
  "iloilo city": [10.7202, 122.5621],
  "iloilo": [10.7202, 122.5621],
  "city proper": [10.6969, 122.5708],
  "molo": [10.6961, 122.5442],
  "timawa": [10.6975, 122.5486],
  "mandurriao": [10.7167, 122.5333],
  "jaro": [10.7289, 122.5594],
  "la paz": [10.7103, 122.5694],
  "lapaz": [10.7103, 122.5694],
  "lapuz": [10.7025, 122.5806],
  "villa arevalo": [10.6861, 122.5186],
  "arevalo": [10.6861, 122.5186],

  // ── 1st District (Southern Iloilo) ──
  "oton": [10.7372, 122.4998],
  "abilay": [10.7372, 122.4998],
  "tigbauan": [10.6750, 122.3789],
  "guimbal": [10.6713, 122.3353],
  "nanga": [10.6713, 122.3353],
  "tubungan": [10.8167, 122.3167],
  "igbaras": [10.7167, 122.2667],
  "miagao": [10.6431, 122.2339],
  "miag-ao": [10.6431, 122.2339],
  "san joaquin": [10.5878, 122.1408],

  // ── 2nd District (Central Iloilo) ──
  "pavia": [10.7744, 122.5408],
  "pagsanga-an": [10.7685, 122.5365],
  "santa barbara": [10.8242, 122.5342],
  "sta. barbara": [10.8242, 122.5342],
  "sta barbara": [10.8242, 122.5342],
  "san miguel": [10.7797, 122.4644],
  "alimodian": [10.8167, 122.4333],
  "leon": [10.7833, 122.3833],
  "leganes": [10.7833, 122.5833],
  "zarraga": [10.8217, 122.6108],
  "new lucena": [10.8667, 122.5833],

  // ── 3rd District (Mid-North Iloilo) ──
  "cabatuan": [10.8800, 122.4883],
  "maasin": [10.8833, 122.4333],
  "janiuay": [10.9575, 122.5022],
  "badiangan": [10.9500, 122.5500],
  "mina": [10.9167, 122.5833],
  "pototan": [10.9472, 122.6289],
  "calinog": [11.1167, 122.5000],
  "bingawan": [11.1667, 122.5333],
  "lambunao": [11.0500, 122.4833],

  // ── 4th District (Eastern Iloilo) ──
  "dingle": [11.0039, 122.6714],
  "duenas": [11.0667, 122.6167],
  "dueñas": [11.0667, 122.6167],
  "san enrique": [11.0833, 122.6333],
  "passi": [11.1072, 122.6414],
  "passi city": [11.1072, 122.6414],
  "barotac nuevo": [10.8906, 122.7042],
  "barotac": [10.8906, 122.7042],
  "dumangas": [10.8250, 122.7167],
  "anilao": [10.9833, 122.7500],
  "banate": [11.0167, 122.8000],

  // ── 5th District (Northern Iloilo) ──
  "barotac viejo": [11.0500, 122.8500],
  "san rafael": [11.1667, 122.8500],
  "lemery": [11.2333, 122.9167],
  "ajuy": [11.1667, 122.9833],
  "sara": [11.2667, 123.0167],
  "concepcion": [11.2167, 123.1167],
  "san dionisio": [11.2667, 123.0833],
  "batad": [11.3167, 123.0833],
  "estancia": [11.4500, 123.1500],
  "balasan": [11.4333, 123.1000],
  "carles": [11.5833, 123.1667],

  // ── Guimaras Island ──
  "jordan": [10.6500, 122.6000],
  "buenavista": [10.7333, 122.6667],
  "nueva valencia": [10.5333, 122.5333],
  "san lorenzo": [10.6167, 122.6833],
  "sibunag": [10.5500, 122.6000],
  "guimaras": [10.6000, 122.6000],

  // ── Neighboring Hubs (Panay / Negros) ──
  "bacolod": [10.6766, 122.9510],
  "bacolod city": [10.6766, 122.9510],
  "roxas": [11.5853, 122.7511],
  "roxas city": [11.5853, 122.7511],
  "kalibo": [11.7083, 122.3667],
  "san jose": [10.7500, 121.9333],
};

/**
 * Default fallback coordinates map for the pre-seeded demo properties
 */
export const DEFAULT_COORDINATES_MAP = {
  1: [10.7372, 122.4998], // LOT-3896 Oton Cadastre
  2: [10.737956, 122.505478], // Lot-2018 Oton Cadastre
  3: [10.671313, 122.335284], // Lot-204 Nanga Guimbal
};

/**
 * ── Dynamic Property Location Resolver ──
 * Resolves accurate coordinates for any existing, newly created, or offline property:
 * 1. Checks localStorage cache (if property center was previously calculated from lots).
 * 2. Checks MUNICIPALITY_COORDINATES table by scanning location string and property name.
 * 3. Checks pre-seeded DEFAULT_COORDINATES_MAP if available.
 * 4. Falls back to Iloilo Province Center [10.7202, 122.5621].
 *
 * @param {number|string} propertyId
 * @param {string} [locationString]
 * @param {string} [propertyName]
 * @returns {[number, number]} [lat, lng]
 */
export function getPropertyFallbackCoordinates(propertyId, locationString = "", propertyName = "") {
  const propIdNum = Number(propertyId);

  // 1. Check auto-saved cache in localStorage
  try {
    const cached = localStorage.getItem(`prop_center_${propIdNum}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length >= 2 && Number.isFinite(parsed[0]) && Number.isFinite(parsed[1])) {
        return [parsed[0], parsed[1]];
      }
    }
  } catch (e) {}

  // 2. Scan location string & property name against our 43+ Municipalities Database
  const combined = `${locationString || ""} ${propertyName || ""}`.toLowerCase();
  for (const [key, coords] of Object.entries(MUNICIPALITY_COORDINATES)) {
    if (combined.includes(key)) {
      return coords;
    }
  }

  // 3. Pre-seeded demo properties fallback
  if (DEFAULT_COORDINATES_MAP[propIdNum]) {
    return DEFAULT_COORDINATES_MAP[propIdNum];
  }

  // 4. Universal Iloilo Province Center
  return [10.7202, 122.5621];
}

/**
 * Known Iloilo / Panay Locations & Municipalities Database (Instant High-Accuracy Local Cache)
 */
const KNOWN_ILOILO_PLACES = [
  { keywords: ["timawa", "timawa i", "timawa ii", "timawa avenue", "molo timawa"], lat: 10.6975, lng: 122.5486, name: "Timawa, Molo, Iloilo City" },
  { keywords: ["molo", "molo plaza", "san pedro molo", "infante", "calumpang", "san juan molo"], lat: 10.6961, lng: 122.5442, name: "Molo, Iloilo City" },
  { keywords: ["mandurriao", "tabucan", "q. abeto", "guzman jesena", "bakhaw", "megaworld", "festive walk", "atria"], lat: 10.7167, lng: 122.5333, name: "Mandurriao, Iloilo City" },
  { keywords: ["jaro", "cubay", "sambag", "balantang", "tagbak", "buntatala", "bito-on", "jaro plaza"], lat: 10.7289, lng: 122.5594, name: "Jaro, Iloilo City" },
  { keywords: ["la paz", "lapaz", "la paz plaza", "nabitasan", "gusa", "baldoza", "magdalo"], lat: 10.7103, lng: 122.5694, name: "La Paz, Iloilo City" },
  { keywords: ["lapuz", "bo. obrerom", "lapuz norte", "lapuz sur", "mansaya", "progreso"], lat: 10.7025, lng: 122.5806, name: "Lapuz, Iloilo City" },
  { keywords: ["villa", "villa arevalo", "arevalo", "calaparan", "sto. nino sur", "sto. nino norte", "sta. cruz", "sooc"], lat: 10.6861, lng: 122.5186, name: "Villa Arevalo, Iloilo City" },
  { keywords: ["city proper", "plaza libertad", "calle real", "delgado", "valeria", "general luna", "ledezma", "iznart"], lat: 10.6969, lng: 122.5708, name: "City Proper, Iloilo City" },
  { keywords: ["pagsanga-an", "pagsangan", "pagsang-an"], lat: 10.7685, lng: 122.5365, name: "Pagsanga-an, Pavia, Iloilo" },
  { keywords: ["pavia", "ungka", "pandac", "tigum", "jibao-an", "amparo", "balabag"], lat: 10.7766, lng: 122.5422, name: "Pavia, Iloilo" },
  { keywords: ["oton", "cadastre", "abilay", "poblacion oton", "san nicolas oton", "trapiche", "buray"], lat: 10.7006, lng: 122.4839, name: "Oton, Iloilo" },
  { keywords: ["guimbal", "nanga", "particion", "poblacion guimbal", "camangahan"], lat: 10.6631, lng: 122.3197, name: "Guimbal, Iloilo" },
  { keywords: ["barotac nuevo", "barotac", "tabuc suba barotac", "lagasan", "sohoton"], lat: 10.8931, lng: 122.7058, name: "Barotac Nuevo, Iloilo" },
  { keywords: ["barotac viejo"], lat: 11.0500, lng: 122.8500, name: "Barotac Viejo, Iloilo" },
  { keywords: ["santa barbara", "sta. barbara", "sta barbara", "buyo", "tinucuan"], lat: 10.8211, lng: 122.5336, name: "Santa Barbara, Iloilo" },
  { keywords: ["cabatuan", "bitaogan", "poblacion cabatuan"], lat: 10.8800, lng: 122.4883, name: "Cabatuan, Iloilo" },
  { keywords: ["leganes", "guihaman", "cagamutan"], lat: 10.7858, lng: 122.5897, name: "Leganes, Iloilo" },
  { keywords: ["zarraga", "tuburan", "dawis"], lat: 10.8222, lng: 122.6106, name: "Zarraga, Iloilo" },
  { keywords: ["dumangas", "pagdugue", "paloc sool"], lat: 10.8306, lng: 122.7153, name: "Dumangas, Iloilo" },
  { keywords: ["san miguel", "san roque san miguel"], lat: 10.7797, lng: 122.4644, name: "San Miguel, Iloilo" },
  { keywords: ["tigbauan", "namocon", "atanoc"], lat: 10.6750, lng: 122.3789, name: "Tigbauan, Iloilo" },
  { keywords: ["miagao", "miag-ao", "kirayan", "sapa miagao"], lat: 10.6431, lng: 122.2339, name: "Miagao, Iloilo" },
  { keywords: ["san joaquin", "tiolas", "pitogo"], lat: 10.5878, lng: 122.1408, name: "San Joaquin, Iloilo" },
  { keywords: ["passi", "passi city", "sablogon"], lat: 11.1072, lng: 122.6414, name: "Passi City, Iloilo" },
  { keywords: ["pototan", "rumbang", "santo nino pototan"], lat: 10.9489, lng: 122.6289, name: "Pototan, Iloilo" },
  { keywords: ["janiuay", "tamcol", "aquino"], lat: 10.9575, lng: 122.5022, name: "Janiuay, Iloilo" },
  { keywords: ["dingle", "tabugon"], lat: 11.0039, lng: 122.6714, name: "Dingle, Iloilo" },
  { keywords: ["alimodian"], lat: 10.8167, lng: 122.4333, name: "Alimodian, Iloilo" },
  { keywords: ["leon"], lat: 10.7833, lng: 122.3833, name: "Leon, Iloilo" },
  { keywords: ["iloilo city", "iloilo"], lat: 10.7202, lng: 122.5621, name: "Iloilo City, Philippines" },
];

/**
 * Strips cadastral lot numbers, block names, and formatting noise to extract real geographic places.
 */
function cleanCadastralString(raw) {
  if (!raw) return "";
  return raw
    .replace(/lot\s*[-_#]?\s*\d+/gi, " ")
    .replace(/blk\s*[-_#]?\s*\d+/gi, " ")
    .replace(/block\s*[-_#]?\s*\d+/gi, " ")
    .replace(/phase\s*[-_#]?\s*\d+/gi, " ")
    .replace(/model/gi, " ")
    .replace(/cadastre/gi, " ")
    .replace(/cadestra/gi, " ")
    .replace(/subdivision/gi, " ")
    .replace(/estate/gi, " ")
    .replace(/[-_.,/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Live search suggestions function triggered as the user types
 * Returns real-time suggestions specifically within Iloilo, with local high-speed cache.
 * @param {string} text - query typed by user (e.g. "timawa", "molo", "pavia", "barotac")
 * @returns {Promise<Array<{lat: number, lng: number, displayName: string}>>}
 */
export async function searchLocationSuggestions(text) {
  if (!text || typeof text !== "string" || text.trim().length < 2) {
    return [];
  }

  const query = text.trim().toLowerCase();
  const matched = [];

  // 1. Instant match from local Iloilo database
  for (const place of KNOWN_ILOILO_PLACES) {
    if (
      place.keywords.some((k) => k.includes(query) || query.includes(k)) ||
      place.name.toLowerCase().includes(query)
    ) {
      matched.push({
        lat: place.lat,
        lng: place.lng,
        displayName: place.name,
      });
    }
  }

  // 2. Fetch live suggestions specifically for Iloilo from OpenStreetMap Nominatim
  try {
    const searchParam = query.includes("iloilo") ? query : `${query}, Iloilo, Philippines`;
    const response = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: {
        format: "json",
        q: searchParam,
        limit: 6,
        viewbox: "122.0,10.4,123.3,11.6",
        addressdetails: 1,
      },
      headers: {
        "Accept-Language": "en",
      },
      timeout: 2500,
    });

    if (Array.isArray(response.data)) {
      response.data.forEach((item) => {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        const displayName = item.display_name;

        // Ensure within Iloilo / Panay bounding box (Lat: 10.2 to 11.8, Lng: 121.8 to 123.5)
        const isWithinIloilo =
          lat >= 10.2 && lat <= 11.8 && lng >= 121.8 && lng <= 123.5;

        // Avoid adding duplicate coordinates
        const isDuplicate = matched.some(
          (m) => Math.hypot(m.lat - lat, m.lng - lng) < 0.002
        );

        if (isWithinIloilo && !isDuplicate && !isNaN(lat) && !isNaN(lng)) {
          matched.push({
            lat,
            lng,
            displayName,
          });
        }
      });
    }
  } catch (err) {
    // Return local matches if rate-limited or offline
  }

  return matched.slice(0, 6);
}

/**
 * Searches for GPS coordinates specifically within Iloilo for a given address
 */
export async function geocodeAddress(address) {
  if (!address || typeof address !== "string" || !address.trim()) {
    return null;
  }

  const rawAddress = address.trim();
  const cleanedAddress = cleanCadastralString(rawAddress);
  const lowerRaw = rawAddress.toLowerCase();
  const lowerClean = cleanedAddress.toLowerCase();

  // 1. Check known Iloilo/Panay location dictionary
  for (const place of KNOWN_ILOILO_PLACES) {
    for (const kw of place.keywords) {
      if (lowerRaw.includes(kw) || lowerClean.includes(kw)) {
        return {
          lat: place.lat,
          lng: place.lng,
          displayName: place.name,
        };
      }
    }
  }

  // 2. Perform live Nominatim Search for Iloilo
  const queriesToTry = [
    cleanedAddress ? `${cleanedAddress}, Iloilo, Philippines` : null,
    rawAddress ? `${rawAddress}, Iloilo, Philippines` : null,
    cleanedAddress ? `${cleanedAddress}, Philippines` : null,
  ].filter(Boolean);

  for (const query of queriesToTry) {
    try {
      const response = await axios.get("https://nominatim.openstreetmap.org/search", {
        params: {
          format: "json",
          q: query,
          limit: 3,
          viewbox: "122.0,10.4,123.3,11.6",
          addressdetails: 1,
        },
        headers: {
          "Accept-Language": "en",
        },
        timeout: 3000,
      });

      if (Array.isArray(response.data) && response.data.length > 0) {
        const topResult = response.data[0];
        return {
          lat: parseFloat(topResult.lat),
          lng: parseFloat(topResult.lon),
          displayName: topResult.display_name,
        };
      }
    } catch (e) {
      // Continue to next query attempt
    }
  }

  return null;
}
