export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const sourceWidth = 1000;

export const NON_SALEABLE_STYLE = {
  name: "Non-Saleable Area",
  fillSelected: "#94a3b8",
  fillUnselected: "#475569",
  strokeSelected: "#475569",
  strokeUnselected: "#64748b",
};

export const CATEGORY_STYLES = {
  residential: {
    name: "Saleable Lot",
    fillSelected: "#10b981",
    fillUnselected: "#064e3b",
    strokeSelected: "#059669",
    strokeUnselected: "#10b981",
  },
  non_saleable: NON_SALEABLE_STYLE,
  park: NON_SALEABLE_STYLE,
  facility: NON_SALEABLE_STYLE,
  excluded: NON_SALEABLE_STYLE,
  open_space: NON_SALEABLE_STYLE,
};
