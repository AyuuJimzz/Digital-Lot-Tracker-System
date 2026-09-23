// controllers/developer/devSystemController.js
const fs = require("fs");
const {
  configPath,
  devPinRateLimiter,
  getActiveDeveloperPin,
  setRuntimeCustomPin,
  requireDeveloper,
  readSystemStateFile,
  updateSystemStateFile,
} = require("./devSystemStateService");
const devDiagnosticsController = require("./devDiagnosticsController");
const devKillSwitchController = require("./devKillSwitchController");
const { addDeveloperLog, logAuthEvent, parseDevice, getClientIp } = require("../../services/loggerService");
const { sendMessengerAlert } = require("../../services/messengerAlertService");

// ── VERIFY DEVELOPER PIN ──
exports.verifyPin = (req, res) => {
  const { pin } = req.body;
  const activePin = getActiveDeveloperPin();

  if (!pin) {
    if (req.session) req.session.isDeveloper = false;
    return res.status(400).json({ error: "PIN is required" });
  }

  if (pin.toString().trim() === activePin) {
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
exports.changePin = (req, res) => {
  const { currentPin, newPin, confirmNewPin } = req.body;
  const activePin = getActiveDeveloperPin();

  if (!currentPin || !newPin || !confirmNewPin) {
    return res.status(400).json({ error: "All fields are required" });
  }

  if (currentPin.toString().trim() !== activePin) {
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

  setRuntimeCustomPin(cleanNewPin);
  const updatedState = updateSystemStateFile({ developerPin: cleanNewPin, runtimeDeveloperPin: cleanNewPin });
  if (updatedState) {
    logAuthEvent(req, "Developer PIN was successfully changed", {
      type: "SECURITY",
      user: "Developer (Root)",
      role: "Developer",
    });

    try {
      sendMessengerAlert("Developer PIN Updated", "The developer security master PIN was updated successfully.", {
        category: "systemChanges",
        user: "Developer Console",
        ip: getClientIp(req),
      }).catch(() => {});
    } catch (_) {}

    return res.json({ 
      success: true, 
      message: "Developer Security PIN updated successfully!", 
      newPin: cleanNewPin 
    });
  }

  res.status(500).json({ error: "Failed to update Developer PIN" });
};

// ── PUBLIC MAINTENANCE STATUS FOR REDIRECTS ──
exports.getMaintenanceStatus = (req, res) => {
  try {
    let state = { maintenanceMode: false };
    if (fs.existsSync(configPath)) {
      state = JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
    res.json({ maintenanceMode: !!state.maintenanceMode });
  } catch (e) {
    res.json({ maintenanceMode: false });
  }
};

// ── GET SYSTEM STATE & LOGS ──
exports.getSystemState = (req, res) => {
  try {
    let state = { maintenanceMode: false, logs: [] };
    if (fs.existsSync(configPath)) {
      state = JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
    res.json({
      maintenanceMode: !!state.maintenanceMode,
      logs: state.logs || [],
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to read system state" });
  }
};

// ── TOGGLE MAINTENANCE MODE ──
exports.toggleMaintenance = (req, res) => {
  const { maintenanceMode } = req.body;

  if (typeof maintenanceMode !== "boolean") {
    return res.status(400).json({ error: "maintenanceMode must be a boolean" });
  }

  const newState = updateSystemStateFile({ maintenanceMode });
  if (newState) {
    addDeveloperLog(`System maintenance mode set to: ${maintenanceMode ? "ENABLED" : "DISABLED"}`, {
      type: "MAINTENANCE",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });

    try {
      sendMessengerAlert(
        `Maintenance Mode: ${maintenanceMode ? "ENABLED" : "DISABLED"}`,
        `The platform was set to ${maintenanceMode ? "Maintenance Mode (Under Construction)" : "Live Operations Mode"}.`,
        {
          category: "systemChanges",
          user: "Developer Console",
          ip: getClientIp(req),
        }
      ).catch(() => {});
    } catch (_) {}

    return res.json({ success: true, maintenanceMode: newState.maintenanceMode });
  }

  res.status(500).json({ error: "Failed to toggle maintenance mode" });
};

// ── CLEAR CONSOLE LOGS ──
exports.clearLogs = (req, res) => {
  const { type } = req.body;
  
  let currentState = { maintenanceMode: false, developerPin: "1234", logs: [] };
  if (fs.existsSync(configPath)) {
    try {
      currentState = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (err) {}
  }
  
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
exports.getActiveDeveloperPin = getActiveDeveloperPin;
exports.readSystemStateFile = readSystemStateFile;
exports.updateSystemStateFile = updateSystemStateFile;
