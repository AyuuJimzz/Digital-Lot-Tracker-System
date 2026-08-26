/**
 * Keep-Alive Pinger for Render.com Free Tier Backend
 *
 * Render.com free-tier services sleep after 15 minutes of inactivity,
 * causing a 30–60 second cold start delay on the next request.
 *
 * This utility pings the /api/health endpoint every 14 minutes (just before
 * the 15-minute sleep threshold) to keep the server warm.
 *
 * - Runs only when deployed (non-localhost)
 * - Uses requestIdleCallback so it NEVER blocks UI rendering
 * - Sends a lightweight HEAD request (no body, minimal bandwidth)
 */

const KEEP_ALIVE_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes
const BACKEND_URL = "https://golden-dragon-estate-backend.onrender.com";

let pingTimer = null;

function sendPing() {
  if (
    typeof window === "undefined" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    return; // Skip keep-alive on local development
  }

  const run = () => {
    fetch(`${BACKEND_URL}/api/health`, {
      method: "HEAD",
      cache: "no-store",
    }).catch(() => {
      // Silently ignore — server may be temporarily unreachable
    });
  };

  // Use idle callback so ping never blocks user interaction
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 5000 });
  } else {
    setTimeout(run, 0);
  }
}

/**
 * Start the keep-alive pinger.
 * Call once from your app entry point (e.g. App.js or index.js).
 */
export function startKeepAlive() {
  if (pingTimer) return; // Already started

  // Immediate ping on app load (wakes up server while user is logging in)
  sendPing();

  // Then ping every 14 minutes
  pingTimer = setInterval(sendPing, KEEP_ALIVE_INTERVAL_MS);
}

/**
 * Stop the keep-alive pinger (call on app unmount if needed).
 */
export function stopKeepAlive() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}
