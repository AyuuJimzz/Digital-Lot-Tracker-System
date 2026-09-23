// controllers/developer/devSystemController.js
const {
  devPinRateLimiter,
  verifyDeveloperPin,
  requireDeveloper,
  readSystemStateFile,
  updateSystemStateFile,
  updateDurableSystemStateFile,
} = require("./devSystemStateService");
const bcrypt = require("bcryptjs");
const devDiagnosticsController = require("./devDiagnosticsController");
const devKillSwitchController = require("./devKillSwitchController");
const { addDeveloperLog, logAuthEvent, parseDevice, getClientIp } = require("../../services/loggerService");

// ── VERIFY DEVELOPER PIN ──
exports.verifyPin = async (req, res) => {
  const { pin } = req.body;

  if (!pin) {
    if (req.session) req.session.isDeveloper = false;
    return res.status(400).json({ error: "PIN is required" });
  }

  if (await verifyDeveloperPin(pin)) {
    if (req.session) req.session.isDeveloper = true;
    logAuthEvent(req, "Developer console authenticated", {
      type: "SECURITY",
      user: "Developer (Root)",
      role: "Developer",
    });
    return res.json({ success: true, message: "Developer authentication successful" });
  }

  if (req.session) {
    req.session.isDeveloper = false;
  }
  logAuthEvent(req, "Failed Developer PIN authentication attempt", {
    type: "SECURITY",
    user: "Unknown",
    role: "Developer",
  });
  return res.status(401).json({ error: "Invalid Developer PIN" });
};

// ── CHANGE DEVELOPER PIN ──
exports.changePin = async (req, res) => {
  const { currentPin, newPin, confirmNewPin } = req.body;

  if (!currentPin || !newPin || !confirmNewPin) {
    return res.status(400).json({ error: "All fields are required" });
  }

  if (!(await verifyDeveloperPin(currentPin))) {
    return res.status(400).json({ error: "Current PIN is incorrect" });
  }

  const cleanNewPin = newPin.toString().trim();
  const cleanConfirmPin = confirmNewPin.toString().trim();

  if (cleanNewPin.length < 4) {
    return res.status(400).json({ error: "New PIN must be at least 4 digits or characters long" });
  }

  if (cleanNewPin !== cleanConfirmPin) {
    return res.status(400).json({ error: "New PIN and confirmation PIN do not match" });
  }

  try {
    const developerPinHash = await bcrypt.hash(cleanNewPin, 10);
    await updateDurableSystemStateFile(
      { developerPinHash },
      ["developerPin", "runtimeDeveloperPin"]
    );
    logAuthEvent(req, "Developer PIN was successfully changed", {
      type: "SECURITY",
      user: "Developer (Root)",
      role: "Developer",
    });

    return res.json({ success: true, message: "Developer Security PIN updated successfully!" });
  } catch (error) {
    console.error("Failed to update Developer PIN:", error);
    return res.status(503).json({ error: "Failed to persist Developer PIN. Please try again." });
  }
};

// ── PUBLIC MAINTENANCE STATUS FOR REDIRECTS ──
exports.getMaintenanceStatus = (req, res) => {
  const state = readSystemStateFile();
  res.json({ maintenanceMode: !!state.maintenanceMode });
};

// ── GET SYSTEM STATE & LOGS ──
exports.getSystemState = (req, res) => {
  const state = readSystemStateFile();
  res.json({ maintenanceMode: !!state.maintenanceMode, logs: state.logs || [] });
};

// ── TOGGLE MAINTENANCE MODE ──
exports.toggleMaintenance = async (req, res) => {
  const { maintenanceMode } = req.body;

  if (typeof maintenanceMode !== "boolean") {
    return res.status(400).json({ error: "maintenanceMode must be a boolean" });
  }

  try {
    const newState = await updateDurableSystemStateFile({ maintenanceMode });
    addDeveloperLog(`System maintenance mode set to: ${maintenanceMode ? "ENABLED" : "DISABLED"}`, {
      type: "MAINTENANCE",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });

    return res.json({ success: true, maintenanceMode: newState.maintenanceMode });
  } catch (error) {
    console.error("Failed to persist maintenance mode:", error);
    return res.status(503).json({ error: "Failed to persist maintenance mode. Please try again." });
  }
};

// ── CLEAR CONSOLE LOGS ──
exports.clearLogs = (req, res) => {
  const { type } = req.body;
  
  const currentState = readSystemStateFile();
  
  let filteredLogs = [];
  if (type === "AUTH") {
    filteredLogs = (currentState.logs || []).filter(
      (log) => (log.type || "").toUpperCase() !== "AUTH"
    );
  } else if (type === "SECURITY") {
    filteredLogs = (currentState.logs || []).filter(
      (log) => !["SECURITY", "ERROR", "CRASH"].includes((log.type || "").toUpperCase()) && !(log.event || "").includes("KILL SWITCH") && !(log.event || "").includes("System Error")
    );
  } else if (type === "DATABASE") {
    filteredLogs = (currentState.logs || []).filter(
      (log) => (log.type || "").toUpperCase() !== "DATABASE" && (log.type || "").toUpperCase() !== "BACKUP" && !(log.event || "").includes("Capstone") && !(log.event || "").includes("Purged")
    );
  } else if (type === "SYSTEM" || type === "MAINTENANCE") {
    filteredLogs = (currentState.logs || []).filter(
      (log) => !["SYSTEM", "MAINTENANCE", "ADMIN", "EMAIL"].includes((log.type || "").toUpperCase())
    );
  } else {
    filteredLogs = [];
  }

  const updatedState = updateSystemStateFile({ logs: filteredLogs });
  if (updatedState) {
    return res.json({ success: true, message: "Logs cleared successfully", logs: filteredLogs });
  }
  res.status(500).json({ error: "Failed to clear logs" });
};

// ── DIAGNOSTICS DELEGATIONS ──
exports.getApiHealth = devDiagnosticsController.getApiHealth;
exports.getEnvHealth = devDiagnosticsController.getEnvHealth;
exports.getMapDiagnostics = devDiagnosticsController.getMapDiagnostics;

// ── KILL SWITCH DELEGATIONS ──
exports.globalKillSwitch = devKillSwitchController.globalKillSwitch;
exports.getGlobalKillSwitchStatus = devKillSwitchController.getGlobalKillSwitchStatus;

// ── HELPER UTILITIES & AUTH MIDDLEWARE DELEGATIONS ──
exports.requireDeveloper = requireDeveloper;
exports.devPinRateLimiter = devPinRateLimiter;
exports.verifyDeveloperPin = verifyDeveloperPin;
exports.readSystemStateFile = readSystemStateFile;
exports.updateSystemStateFile = updateSystemStateFile;
