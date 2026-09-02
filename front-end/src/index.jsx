import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

import L from "leaflet";

// Leaflet tooltip safety patch to prevent "Cannot set properties of null (setting '_source')"
if (typeof window !== "undefined" && L && L.Layer) {
  const origOpenTooltip = L.Layer.prototype.openTooltip;
  if (origOpenTooltip) {
    L.Layer.prototype.openTooltip = function (layer, latlng) {
      if (!this._tooltip || !this._map) return this;
      try {
        return origOpenTooltip.call(this, layer, latlng);
      } catch {
        return this;
      }
    };
  }

  const origCloseTooltip = L.Layer.prototype.closeTooltip;
  if (origCloseTooltip) {
    L.Layer.prototype.closeTooltip = function (tooltip) {
      if (!this._tooltip && !tooltip) return this;
      try {
        return origCloseTooltip.call(this, tooltip);
      } catch {
        return this;
      }
    };
  }
}

// Suppress external browser extension runtime errors and transient Leaflet hover events from triggering React dev overlay
const isExtensionOrLeafletError = (event) => {
  const str =
    (event?.filename || "") +
    " " +
    (event?.message || "") +
    " " +
    (event?.error?.stack || "") +
    " " +
    (event?.reason?.stack || "") +
    " " +
    (event?.reason?.message || "");
  return (
    str.includes("chrome-extension://") ||
    str.includes("moz-extension://") ||
    str.includes("M_ID") ||
    str.includes("eppiocemhmnlbhjplcgkofciiegomcon") ||
    str.includes("setting '_source'") ||
    str.includes("setting '_source") ||
    str.includes("_source")
  );
};

window.addEventListener(
  "error",
  (event) => {
    if (isExtensionOrLeafletError(event)) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  },
  true
);

window.addEventListener(
  "unhandledrejection",
  (event) => {
    if (isExtensionOrLeafletError(event)) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  },
  true
);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
