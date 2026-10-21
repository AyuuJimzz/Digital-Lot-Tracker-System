// utils/subdivisionColors.js
// Centralized, synchronized color palette management for subdivision analytics across the admin dashboard.

import axios from "axios";
import { API_BASE_URL } from "../config/api";

export const DEFAULT_SUBDIVISION_PALETTE = [
  {
    nameMatch: "2018",
    color: "#f43f5e", // Sunset Coral / Rose
    name: "Sunset Coral",
  },
  {
    nameMatch: "3896",
    color: "#06b6d4", // Vivid Cyan Blue
    name: "Vivid Cyan",
  },
  {
    nameMatch: "204",
    color: "#10b981", // Neo Mint / Emerald
    name: "Neo Mint",
  },
  {
    nameMatch: "6275",
    color: "#8b5cf6", // Electric Violet / Purple
    name: "Electric Violet",
  },
  {
    nameMatch: "blue",
    color: "#3b82f6", // Royal Blue
    name: "Royal Blue",
  },
  {
    nameMatch: "fuchsia",
    color: "#d946ef", // Fuchsia / Magenta
    name: "Fuchsia",
  },
  {
    nameMatch: "teal",
    color: "#14b8a6", // Bright Teal
    name: "Bright Teal",
  },
];

const STORAGE_KEY = "gde_subdivision_colors";

const getAuthConfig = () => {
  try {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("authToken") : null;
    return {
      withCredentials: true,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    };
  } catch (_) {
    return { withCredentials: true };
  }
};

let dbSaveTimer = null;
let isSyncing = false;

/**
 * Flush any pending debounced database sync immediately.
 */
export const flushSubdivisionColorsSync = async () => {
  if (dbSaveTimer) {
    clearTimeout(dbSaveTimer);
    dbSaveTimer = null;
    try {
      if (typeof window === "undefined") return;
      const authConfig = getAuthConfig();
      const colors = loadCustomColors();
      await axios.put(`${API_BASE_URL}/api/lots/subdivision-colors`, { colors }, authConfig);
    } catch (err) {
      console.warn("Subdivision colors database flush warning:", err?.message || err);
    }
  }
};

/**
 * Debounced push of colors palette to the shared database (system_state table).
 */
export const pushColorsToDatabase = (colors) => {
  if (dbSaveTimer) {
    clearTimeout(dbSaveTimer);
  }
  dbSaveTimer = setTimeout(async () => {
    try {
      if (typeof window === "undefined") return;
      const authConfig = getAuthConfig();
      await axios.put(`${API_BASE_URL}/api/lots/subdivision-colors`, { colors }, authConfig);
    } catch (err) {
      console.warn("Subdivision colors database sync warning:", err?.message || err);
    } finally {
      dbSaveTimer = null;
    }
  }, 250);
};

/** Normalize valid 3- or 6-digit CSS hex colors to #RRGGBB. */
export const normalizeHexColor = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;

  const digits = match[1].length === 3
    ? match[1].split("").map((digit) => `${digit}${digit}`).join("")
    : match[1];
  return `#${digits.toLowerCase()}`;
};

/**
 * Load user customized subdivision color overrides from localStorage.
 */
export const loadCustomColors = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn("Failed to load subdivision colors from storage:", err);
    return {};
  }
};

/**
 * Fetch latest synchronized custom colors from the database.
 * If server has custom colors, updates localStorage and notifies dashboard listeners.
 * If server is empty and local storage has custom colors, auto-seeds the database.
 */
export const syncColorsFromDatabase = async () => {
  if (isSyncing || typeof window === "undefined") return loadCustomColors();
  isSyncing = true;
  try {
    const authConfig = getAuthConfig();
    const res = await axios.get(`${API_BASE_URL}/api/lots/subdivision-colors`, authConfig);
    const serverColors = res.data?.colors;

    if (serverColors && typeof serverColors === "object" && !Array.isArray(serverColors)) {
      const sanitized = {};
      for (const [key, val] of Object.entries(serverColors)) {
        const norm = normalizeHexColor(val);
        if (norm) {
          sanitized[String(key)] = norm;
        }
      }

      const localColors = loadCustomColors();
      const hasServerColors = Object.keys(sanitized).length > 0;
      const hasLocalColors = Object.keys(localColors).length > 0;

      if (hasServerColors) {
        const isDifferent = JSON.stringify(sanitized) !== JSON.stringify(localColors);
        if (isDifferent) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
          window.dispatchEvent(
            new CustomEvent("gde-subdivision-color-changed", {
              detail: { colors: sanitized, fromServer: true },
            })
          );
        }
        return sanitized;
      } else if (hasLocalColors) {
        pushColorsToDatabase(localColors);
        return localColors;
      }
    }
    return loadCustomColors();
  } catch (err) {
    console.warn("Failed to fetch subdivision colors from database:", err?.message || err);
    return loadCustomColors();
  } finally {
    isSyncing = false;
  }
};

/**
 * Save custom color for a specific subdivision and notify all dashboard listeners.
 * Updates local cache instantly (optimistic UI) and debounces network sync to database.
 */
export const saveSubdivisionColor = (subdivIdentifier, hexColor) => {
  try {
    const normalizedColor = normalizeHexColor(hexColor);
    if (subdivIdentifier == null || !normalizedColor) return false;

    const loaded = loadCustomColors();
    const current = loaded && typeof loaded === "object" && !Array.isArray(loaded) ? loaded : {};
    const updated = {
      ...current,
      [String(subdivIdentifier)]: normalizedColor,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent("gde-subdivision-color-changed", {
        detail: { identifier: String(subdivIdentifier), color: normalizedColor },
      })
    );

    // Asynchronously synchronize palette to MySQL database
    pushColorsToDatabase(updated);
    return true;
  } catch (err) {
    console.error("Failed to save custom subdivision color:", err);
    return false;
  }
};

/**
 * Reset all customized colors back to the default Neo-Tech Glow palette.
 * Clears local cache instantly and removes state_key from database.
 */
export const resetSubdivisionColors = () => {
  try {
    if (dbSaveTimer) {
      clearTimeout(dbSaveTimer);
      dbSaveTimer = null;
    }
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(
      new CustomEvent("gde-subdivision-color-changed", {
        detail: { reset: true },
      })
    );

    if (typeof window !== "undefined") {
      const authConfig = getAuthConfig();
      axios.delete(`${API_BASE_URL}/api/lots/subdivision-colors`, authConfig).catch((err) => {
        console.warn("Subdivision colors database reset warning:", err?.message || err);
      });
    }
  } catch (err) {
    console.error("Failed to reset custom subdivision colors:", err);
  }
};

/**
 * Compute the active color theme object for a subdivision.
 */
export const getThemeForSubdivision = (subdiv, index, customMap = {}) => {
  const idStr = String(subdiv?.id ?? subdiv?.property_id ?? "");
  const name = subdiv?.name || subdiv?.property_name || subdiv?.shortName || "";
  const key = subdiv?.key || `subdiv_${idStr}`;

  // 1. Check custom overrides by ID, key, or name
  let hexColor = normalizeHexColor(
    customMap[idStr] ||
    customMap[key] ||
    customMap[name]
  );

  // Also check name match if customMap has partial keys
  if (!hexColor) {
    for (const [k, v] of Object.entries(customMap)) {
      if (name && name.toLowerCase().includes(k.toLowerCase())) {
        const normalizedColor = normalizeHexColor(v);
        if (normalizedColor) {
          hexColor = normalizedColor;
          break;
        }
      }
    }
  }

  // 2. Default fallback from built-in palette
  if (!hexColor) {
    const match = DEFAULT_SUBDIVISION_PALETTE.find((t) =>
      name.toLowerCase().includes(t.nameMatch.toLowerCase())
    );
    hexColor = match
      ? match.color
      : DEFAULT_SUBDIVISION_PALETTE[index % DEFAULT_SUBDIVISION_PALETTE.length].color;
  }

  const safeHex = hexColor || "#06b6d4";
  const safeId = (idStr || `sub_${index}`).replace(/[^a-zA-Z0-9]/g, "");

  return {
    hex: safeHex,
    color: safeHex,
    gradientId: `waveGrad_${safeId}`,
    style: {
      dot: { backgroundColor: safeHex },
      bar: {
        background: `linear-gradient(90deg, ${safeHex} 0%, ${adjustBrightness(safeHex, 20)} 100%)`,
        boxShadow: `0 2px 10px -2px ${hexToRgba(safeHex, 0.4)}`,
      },
      badge: {
        color: safeHex,
        backgroundColor: hexToRgba(safeHex, 0.12),
        borderColor: hexToRgba(safeHex, 0.25),
      },
    },
  };
};

/**
 * Helper to generate RGBA string from HEX color.
 */
export const hexToRgba = (hex, alpha = 1) => {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return `rgba(6, 182, 212, ${alpha})`;
  const c = normalized.slice(1);
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(6, 182, 212, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Helper to lighten/darken hex color.
 */
function adjustBrightness(hex, percent) {
  let num = parseInt(hex.replace("#", ""), 16);
  if (isNaN(num)) return hex;
  let r = (num >> 16) + percent;
  let g = ((num >> 8) & 0x00ff) + percent;
  let b = (num & 0x0000ff) + percent;
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
