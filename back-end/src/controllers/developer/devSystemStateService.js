const fs = require("fs");
const path = require("path");
const rateLimit = require("express-rate-limit");

const configPath = path.join(__dirname, "../../../config/system_state.json");

// ── OWASP TOP 10 HARDENING: RATE LIMITER FOR PIN VERIFICATION ──
const devPinRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 attempts per window per IP
  message: { error: "Too many authentication attempts. Please wait 15 minutes before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
});

let runtimeCustomPin = null;

function setRuntimeCustomPin(pin) {
  runtimeCustomPin = pin;
}

function getRuntimeCustomPin() {
  return runtimeCustomPin;
}

// Helper to get active developer PIN (Supports Console UI changes + Render Env Variables)
function getActiveDeveloperPin() {
  if (runtimeCustomPin) {
    return runtimeCustomPin;
  }
  try {
    if (fs.existsSync(configPath)) {
      const state = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (state.runtimeDeveloperPin) return state.runtimeDeveloperPin.toString().trim();
    }
  } catch (err) {}

  const envPin = (process.env.DEVELOPER_PIN || process.env.DEV_PIN || "").toString().trim();
  if (envPin) {
    return envPin;
  }

  try {
    if (fs.existsSync(configPath)) {
      const state = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (state.developerPin) return state.developerPin.toString().trim();
    }
  } catch (err) {}

  return "1234";
}

// Middleware to verify developer session (OWASP A01: Broken Access Control)
function requireDeveloper(req, res, next) {
  const activePin = getActiveDeveloperPin();
  const devKey = req.headers["x-developer-pin"] || req.body?.key;

  if (devKey && devKey.toString().trim() === activePin) {
    if (req.session) {
      req.session.isDeveloper = true;
    }
    return next();
  }

  if (req.session && req.session.isDeveloper) {
    return next();
  }

  return res.status(403).json({ error: "Access Denied: Developer authentication required" });
}

// Helper to read system_state.json
function readSystemStateFile() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
  } catch (err) {}
  return { maintenanceMode: false, developerPin: "1234", logs: [], dismissedMessengerPsids: [] };
}

// Helper to write to system_state.json
function updateSystemStateFile(updatedFields) {
  try {
    let currentState = readSystemStateFile();
    const mergedState = { ...currentState, ...updatedFields };
    fs.writeFileSync(configPath, JSON.stringify(mergedState, null, 2), "utf8");
    return mergedState;
  } catch (e) {
    console.error("Failed to update system_state.json:", e);
    return null;
  }
}

module.exports = {
  configPath,
  devPinRateLimiter,
  getActiveDeveloperPin,
  setRuntimeCustomPin,
  getRuntimeCustomPin,
  requireDeveloper,
  readSystemStateFile,
  updateSystemStateFile,
};
