import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// Suppress external browser extension runtime errors from triggering React dev overlay
const isExtensionError = (event) => {
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
    str.includes("eppiocemhmnlbhjplcgkofciiegomcon")
  );
};

window.addEventListener(
  "error",
  (event) => {
    if (isExtensionError(event)) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  },
  true
);

window.addEventListener(
  "unhandledrejection",
  (event) => {
    if (isExtensionError(event)) {
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
