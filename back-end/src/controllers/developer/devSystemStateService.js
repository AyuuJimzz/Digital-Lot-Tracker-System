const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const {
  configPath,
  getSystemState,
  updateSystemState,
  updateDurableSystemState,
} = require("../../services/systemStateStore");

// ── OWASP TOP 10 HARDENING: RATE LIMITER FOR PIN VERIFICATION ──
const devPinRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 attempts per window per IP
  message: { error: "Too many authentication attempts. Please wait 15 minutes before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// Helper to get active developer PIN (Supports Console UI changes + Render Env Variables)
function getActiveDeveloperPin() {
  const state = getSystemState();
  if (state.runtimeDeveloperPin) return state.runtimeDeveloperPin.toString().trim();

  const envPin = (process.env.DEVELOPER_PIN || process.env.DEV_PIN || "").toString().trim();
  if (envPin) {
    return envPin;
  }

  if (state.developerPin) return state.developerPin.toString().trim();

  const isProduction = process.env.NODE_ENV === "production" || !!process.env.RENDER ||
    process.env.DB_HOST?.includes("aivencloud.com");
  return isProduction ? "" : "1234";
}

async function verifyDeveloperPin(pin) {
  const candidate = pin == null ? "" : pin.toString().trim();
  if (!candidate) return false;

  const hash = getSystemState().developerPinHash;
  if (hash) return bcrypt.compare(candidate, hash);

  const activePin = getActiveDeveloperPin();
  if (!activePin) return false;
  const candidateDigest = crypto.createHash("sha256").update(candidate).digest();
  const activeDigest = crypto.createHash("sha256").update(activePin).digest();
  return crypto.timingSafeEqual(candidateDigest, activeDigest);
}

// Middleware to verify developer session (OWASP A01: Broken Access Control)
async function requireDeveloper(req, res, next) {
  const devKey = req.headers["x-developer-pin"] || req.body?.key;

  if (await verifyDeveloperPin(devKey)) {
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
  return getSystemState();
}

// Helper to write to system_state.json
function updateSystemStateFile(updatedFields) {
  return updateSystemState(updatedFields);
}

function updateDurableSystemStateFile(updatedFields, deleteKeys) {
  return updateDurableSystemState(updatedFields, deleteKeys);
}

module.exports = {
  configPath,
  devPinRateLimiter,
  verifyDeveloperPin,
  requireDeveloper,
  readSystemStateFile,
  updateSystemStateFile,
  updateDurableSystemStateFile,
};
