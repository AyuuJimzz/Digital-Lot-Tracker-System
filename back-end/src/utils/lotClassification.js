// src/utils/lotClassification.js
/**
 * Centralized utility for identifying and handling non-saleable lots
 * (parks, playgrounds, community facilities, clubhouses, excluded lots, etc.)
 */

// Strict word-boundary regex to prevent false positives like "Parkway", "Parkview", or "Amenities Way"
const NON_SALEABLE_REGEX = /\b(park|playground|facility|clubhouse|excluded|open\s+space|easement|community|p\s*&\s*pg|amenity|common|non-saleable|non\s+saleable)\b/i;

const NON_SALEABLE_KEYWORDS = [
  "park",
  "playground",
  "facility",
  "clubhouse",
  "excluded",
  "open space",
  "easement",
  "community",
  "p & pg",
  "amenity",
  "common",
  "non-saleable",
  "non saleable",
];

/**
 * Checks whether a lot label / lot number text indicates a non-saleable parcel.
 * Uses strict word boundary matching to avoid matching substrings like "Parkway".
 * @param {string} lotNumber
 * @returns {boolean}
 */
const isNonSaleableText = (lotNumber) => {
  return NON_SALEABLE_REGEX.test(String(lotNumber || ""));
};

/**
 * Authoritative check for lot saleability.
 * 
 * Database Single Source of Truth:
 * - If `is_non_saleable` is defined (0 or 1), that flag is the STRICT single source of truth.
 *   (e.g., if a saleable lot is named "Parkway" with is_non_saleable=0, it remains SALEABLE).
 * - Word-boundary text matching is ONLY used as a fallback when the column is null or undefined.
 * 
 * @param {object|string} lot
 * @returns {boolean}
 */
const isNonSaleableLot = (lot) => {
  if (!lot) return false;
  if (typeof lot === "string") return isNonSaleableText(lot);

  // 1. Explicit database column (Single Source of Truth)
  if (lot.is_non_saleable !== undefined && lot.is_non_saleable !== null) {
    return Number(lot.is_non_saleable) === 1;
  }
  if (lot.nonSaleable !== undefined && lot.nonSaleable !== null) {
    return Boolean(lot.nonSaleable);
  }
  if (lot._nonSaleable !== undefined && lot._nonSaleable !== null) {
    return Boolean(lot._nonSaleable);
  }

  // 2. Strict word-boundary fallback ONLY if is_non_saleable was omitted/null/undefined
  return isNonSaleableText(lot.lot_number || lot.label || "");
};

/**
 * Strict parser & validator for is_non_saleable flag from requests / API payloads.
 * 
 * Rules:
 * - If value is defined: validates strictly. Accepts only boolean (true/false), integer (1/0),
 *   or strings ("1", "0", "true", "false"). Any other value throws a 400 ValidationError.
 * - If value is undefined or null: falls back to word-boundary lotNumber check, or defaults to 0.
 * 
 * @param {any} value - Incoming request payload value
 * @param {string|null} fallbackLotNumber - Optional lot number to inspect only if value is undefined/null
 * @returns {number} 0 or 1
 * @throws {Error} If value is explicitly provided but invalid
 */
const parseNonSaleableFlag = (value, fallbackLotNumber = null) => {
  if (value !== undefined && value !== null) {
    if (typeof value === "boolean") return value ? 1 : 0;
    if (value === 1 || value === 0) return value;
    if (typeof value === "string") {
      const s = value.trim().toLowerCase();
      if (s === "1" || s === "true") return 1;
      if (s === "0" || s === "false") return 0;
    }

    const error = new Error("Invalid is_non_saleable value. Must be a boolean (true/false) or integer (1/0).");
    error.statusCode = 400;
    throw error;
  }

  if (fallbackLotNumber) {
    return isNonSaleableText(fallbackLotNumber) ? 1 : 0;
  }
  return 0;
};

/**
 * Universal SQL snippet to detect non-saleable lots across queries.
 * Respects `is_non_saleable` as the single source of truth when present.
 * Uses cross-compatible word boundary regex to prevent matching "Parkway".
 */
const NON_SALEABLE_SQL_CONDITION = `(
  CASE 
    WHEN l.is_non_saleable IS NOT NULL THEN (l.is_non_saleable = 1)
    ELSE (
      LOWER(l.lot_number) REGEXP '(^|[^a-zA-Z0-9])(park|playground|facility|clubhouse|excluded|open[[:space:]]+space|easement|community|p[[:space:]]*&[[:space:]]*pg|amenity|common|non-saleable|non[[:space:]]+saleable)([^a-zA-Z0-9]|$)'
    )
  END
)`;

module.exports = {
  NON_SALEABLE_REGEX,
  NON_SALEABLE_KEYWORDS,
  isNonSaleableText,
  isNonSaleableLot,
  parseNonSaleableFlag,
  NON_SALEABLE_SQL_CONDITION,
};
