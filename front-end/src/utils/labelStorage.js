/**
 * labelStorage.js
 * Persists map text annotation labels to localStorage per property.
 */

const KEY_PREFIX = "mapTextLabels_";

export function saveLabels(propertyId, labels) {
  if (!propertyId) return;
  try {
    localStorage.setItem(KEY_PREFIX + propertyId, JSON.stringify(labels || []));
  } catch (e) {
    console.warn("labelStorage: Failed to save labels:", e);
  }
}

export function loadLabels(propertyId) {
  if (!propertyId) return [];
  try {
    const raw = localStorage.getItem(KEY_PREFIX + propertyId);
    if (!raw) return [];
    return JSON.parse(raw) || [];
  } catch (e) {
    console.warn("labelStorage: Failed to load labels:", e);
    return [];
  }
}

export function generateLabelId() {
  return "lbl-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
}
