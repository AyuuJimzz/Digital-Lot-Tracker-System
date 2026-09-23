// controllers/developer/devSystemController.js
const fs = require("fs");
const path = require("path");
const rateLimit = require("express-rate-limit");
const db = require("../../../config/database_connection");
const { addDeveloperLog, logAuthEvent, parseDevice, getClientIp } = require("../../services/loggerService");
const { sendMessengerAlert } = require("../../services/messengerAlertService");

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

  runtimeCustomPin = cleanNewPin;
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

// ── API ROUTES & ENDPOINT HEALTH MONITOR ──
exports.getApiHealth = async (req, res) => {
  const routesToCheck = [
    {
      name: "Subdivision Properties API",
      path: "/api/properties",
      method: "GET",
      domain: "Public / Map",
      description: "Fetches active subdivision properties and estates",
      check: async () => {
        const [rows] = await db.query("SELECT property_id, property_name FROM properties LIMIT 1");
        return { count: rows.length };
      },
    },
    {
      name: "Lot Inventory & Coordinates",
      path: "/api/lots",
      method: "GET",
      domain: "Public / Map",
      description: "Retrieves subdivision lots and 2D map polygon coordinates",
      check: async () => {
        const [rows] = await db.query("SELECT lot_id, lot_number FROM lots LIMIT 1");
        return { count: rows.length };
      },
    },
    {
      name: "Transactions & Audit History",
      path: "/api/transactions",
      method: "GET",
      domain: "Transactions",
      description: "Client lot purchases, reservations, and payment logs",
      check: async () => {
        const [rows] = await db.query("SELECT transaction_id FROM transactions LIMIT 1");
        return { count: rows.length };
      },
    },
    {
      name: "Customer Directory API",
      path: "/api/customers",
      method: "GET",
      domain: "Transactions",
      description: "Buyer registry, contacts, and email records",
      check: async () => {
        const [rows] = await db.query("SELECT customer_id FROM customers LIMIT 1");
        return { count: rows.length };
      },
    },
    {
      name: "Admin Dashboard KPI Engine",
      path: "/api/lots/dashboard-stats",
      method: "GET",
      domain: "Analytics",
      description: "Live lot summary totals and client aggregations",
      check: async () => {
        const [rows] = await db.query("SELECT COUNT(*) as cnt FROM lots");
        return { totalLots: rows[0].cnt };
      },
    },
    {
      name: "Monthly Recap Sales Trends",
      path: "/api/lots/monthly-sales",
      method: "GET",
      domain: "Analytics",
      description: "Monthly aggregation chart figures for annual reports",
      check: async () => {
        const [rows] = await db.query("SELECT COUNT(*) as cnt FROM transactions");
        return { totalTransactions: rows[0].cnt };
      },
    },
    {
      name: "Staff & Agent Personnel Management",
      path: "/api/employees",
      method: "GET",
      domain: "Administration",
      description: "Staff directory, credentials, and access levels",
      check: async () => {
        const [rows] = await db.query("SELECT employee_id FROM employees LIMIT 1");
        return { count: rows.length };
      },
    },
    {
      name: "Root Administrator Registry",
      path: "/api/developer/admins",
      method: "GET",
      domain: "Security",
      description: "System administrators with elevated management access",
      check: async () => {
        const [rows] = await db.query("SELECT admin_id FROM admins LIMIT 1");
        return { count: rows.length };
      },
    },
  ];

  const results = [];
  let healthyCount = 0;
  let degradedCount = 0;
  let downCount = 0;

  for (const item of routesToCheck) {
    const start = Date.now();
    try {
      const details = await item.check();
      const latencyMs = Date.now() - start;
      let status = "HEALTHY";
      if (latencyMs > 250) {
        status = "DEGRADED";
        degradedCount += 1;
      } else {
        healthyCount += 1;
      }

      results.push({
        name: item.name,
        path: item.path,
        method: item.method,
        domain: item.domain,
        description: item.description,
        status,
        latencyMs,
        details,
        lastChecked: new Date().toISOString(),
      });
    } catch (err) {
      downCount += 1;
      results.push({
        name: item.name,
        path: item.path,
        method: item.method,
        domain: item.domain,
        description: item.description,
        status: "DOWN",
        latencyMs: Date.now() - start,
        error: err.message,
        lastChecked: new Date().toISOString(),
      });
    }
  }

  let systemHealth = "OPERATIONAL";
  if (downCount > 0) systemHealth = "OUTAGE_DETECTED";
  else if (degradedCount > 0) systemHealth = "DEGRADED_PERFORMANCE";

  res.json({
    success: true,
    systemHealth,
    healthyCount,
    degradedCount,
    downCount,
    totalEndpoints: routesToCheck.length,
    endpoints: results,
    timestamp: new Date().toISOString(),
  });
};

// ── ENVIRONMENT VARIABLES HEALTH CHECK ──
exports.getEnvHealth = (req, res) => {
  const envSpecs = [
    {
      key: "DB_HOST",
      category: "Database",
      required: true,
      description: "MySQL host address (Localhost or Aiven Cloud URL)",
      mask: false,
    },
    {
      key: "DB_USER",
      category: "Database",
      required: true,
      description: "Database authentication username",
      mask: false,
    },
    {
      key: "DB_PASSWORD",
      category: "Database",
      required: false,
      description: "Database authentication password",
      mask: true,
    },
    {
      key: "DB_NAME",
      category: "Database",
      required: true,
      description: "Target database schema name",
      mask: false,
    },
    {
      key: "PORT",
      category: "Server",
      required: false,
      description: "HTTP server listener port (e.g. 5000 or Render PORT)",
      mask: false,
      default: "5000",
    },
    {
      key: "NODE_ENV",
      category: "Server",
      required: false,
      description: "Runtime environment mode (development / production)",
      mask: false,
      default: "development",
    },
    {
      key: "SESSION_SECRET",
      category: "Security",
      required: true,
      description: "Cookie and express-session encryption key",
      mask: true,
    },
    {
      key: "JWT_SECRET",
      category: "Security",
      required: true,
      description: "Cryptographic secret for signing Admin/Employee JWT tokens",
      mask: true,
    },
    {
      key: "DEVELOPER_PIN",
      category: "Security",
      required: false,
      description: "Developer Panel root master security PIN fallback",
      mask: true,
    },
    {
      key: "EMAIL_USER",
      category: "Notifications",
      required: false,
      description: "Primary outgoing sender email address for notifications",
      mask: false,
    },
    {
      key: "BREVO_API_KEY",
      category: "Notifications",
      required: false,
      description: "Brevo Transactional Email HTTPS API key",
      mask: true,
    },
    {
      key: "FB_PAGE_ACCESS_TOKEN",
      category: "Notifications",
      required: false,
      description: "Meta / Facebook Page Access Token for Messenger developer alerts",
      mask: true,
    },
    {
      key: "FB_RECIPIENT_PSID",
      category: "Notifications",
      required: false,
      description: "Developer personal Facebook Messenger User ID (PSID)",
      mask: true,
    },
  ];

  const maskValue = (val) => {
    if (!val) return "";
    if (val.length <= 8) return "••••••••";
    return `${val.slice(0, 4)}••••••••${val.slice(-4)}`;
  };

  const variables = envSpecs.map((spec) => {
    const rawVal = process.env[spec.key] || (spec.default ? spec.default : "");
    const isSet = process.env[spec.key] !== undefined && process.env[spec.key] !== "";
    const isDefault = !process.env[spec.key] && !!spec.default;

    let displayVal = "";
    if (isSet || isDefault) {
      displayVal = spec.mask ? maskValue(rawVal) : rawVal;
    }

    let status = "CONFIGURED";
    if (!isSet && spec.required) status = "MISSING_REQUIRED";
    else if (!isSet && isDefault) status = "USING_DEFAULT";
    else if (!isSet) status = "OPTIONAL_NOT_SET";

    return {
      key: spec.key,
      category: spec.category,
      required: spec.required,
      description: spec.description,
      isSet: isSet || isDefault,
      status,
      displayValue: displayVal,
    };
  });

  const totalRequired = envSpecs.filter((s) => s.required).length;
  const configuredRequired = variables.filter((v) => v.required && v.isSet).length;
  const allRequiredSet = configuredRequired === totalRequired;

  res.json({
    success: true,
    allRequiredSet,
    configuredCount: variables.filter((v) => v.isSet).length,
    totalCount: variables.length,
    totalRequired,
    configuredRequired,
    variables,
  });
};

// ── EMERGENCY GLOBAL KILL SWITCH / FORCE LOGOUT ALL ──
exports.globalKillSwitch = (req, res) => {
  try {
    const timestamp = new Date().toISOString();
    updateSystemStateFile({ authRevocationTimestamp: timestamp });

    addDeveloperLog(`🚨 EMERGENCY GLOBAL KILL SWITCH: Force-logged out all active sessions and invalidated all issued JWT tokens.`, {
      type: "SECURITY",
      role: "Developer",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });

    res.json({
      success: true,
      timestamp,
      message: "Emergency Global Kill Switch triggered successfully! All active JWT tokens and sessions have been invalidated immediately.",
    });
  } catch (err) {
    console.error("Global kill switch error:", err);
    res.status(500).json({ error: "Failed to trigger global kill switch", message: err.message });
  }
};

// ── GET GLOBAL KILL SWITCH STATUS ──
exports.getGlobalKillSwitchStatus = (req, res) => {
  try {
    let authRevocationTimestamp = null;
    if (fs.existsSync(configPath)) {
      const state = JSON.parse(fs.readFileSync(configPath, "utf8"));
      authRevocationTimestamp = state.authRevocationTimestamp || null;
    }
    res.json({ success: true, authRevocationTimestamp });
  } catch (err) {
    res.status(500).json({ error: "Failed to get kill switch status" });
  }
};

// ── MAP & LOT COORDINATES DIAGNOSTICS ──
exports.getMapDiagnostics = async (req, res) => {
  try {
    const [properties] = await db.query(
      "SELECT property_id, property_name, location, total_lots FROM properties ORDER BY property_name ASC"
    );

    const [lots] = await db.query(`
      SELECT 
        l.lot_id, 
        l.property_id, 
        p.property_name,
        l.lot_number, 
        l.area_sqm, 
        l.status, 
        l.coordinates 
      FROM lots l
      LEFT JOIN properties p ON l.property_id = p.property_id
      ORDER BY p.property_name ASC, CAST(l.lot_number AS UNSIGNED) ASC, l.lot_number ASC
    `);

    let totalLots = lots.length;
    let mappedCount = 0;
    let unmappedCount = 0;
    let corruptedCount = 0;
    let pointOnlyCount = 0;
    let polygonCount = 0;

    const propertyMap = {};
    for (const prop of properties) {
      propertyMap[prop.property_id] = {
        propertyId: prop.property_id,
        propertyName: prop.property_name,
        location: prop.location,
        totalLots: 0,
        mappedLots: 0,
        unmappedLots: 0,
        corruptedLots: 0,
        coveragePct: 0,
      };
    }

    const flaggedLots = [];

    for (const lot of lots) {
      const propId = lot.property_id;
      if (!propertyMap[propId]) {
        propertyMap[propId] = {
          propertyId: propId,
          propertyName: lot.property_name || `Property #${propId}`,
          location: "N/A",
          totalLots: 0,
          mappedLots: 0,
          unmappedLots: 0,
          corruptedLots: 0,
          coveragePct: 0,
        };
      }

      propertyMap[propId].totalLots += 1;

      if (!lot.coordinates) {
        unmappedCount += 1;
        propertyMap[propId].unmappedLots += 1;
        flaggedLots.push({
          lotId: lot.lot_id,
          propertyId: lot.property_id,
          propertyName: lot.property_name || "Unknown",
          lotNumber: lot.lot_number,
          status: lot.status,
          areaSqm: lot.area_sqm,
          issue: "Missing Coordinates",
          issueType: "UNMAPPED",
          severity: "warning",
          description: "No polygon or pin saved. This lot is invisible on the interactive map.",
        });
        continue;
      }

      let parsed = null;
      try {
        parsed = typeof lot.coordinates === "string" ? JSON.parse(lot.coordinates) : lot.coordinates;
      } catch (err) {
        corruptedCount += 1;
        propertyMap[propId].corruptedLots += 1;
        flaggedLots.push({
          lotId: lot.lot_id,
          propertyId: lot.property_id,
          propertyName: lot.property_name || "Unknown",
          lotNumber: lot.lot_number,
          status: lot.status,
          areaSqm: lot.area_sqm,
          issue: "Corrupted JSON",
          issueType: "CORRUPTED",
          severity: "danger",
          description: "Invalid JSON format in coordinates column. Needs repair.",
        });
        continue;
      }

      if (!Array.isArray(parsed) || parsed.length === 0) {
        unmappedCount += 1;
        propertyMap[propId].unmappedLots += 1;
        flaggedLots.push({
          lotId: lot.lot_id,
          propertyId: lot.property_id,
          propertyName: lot.property_name || "Unknown",
          lotNumber: lot.lot_number,
          status: lot.status,
          areaSqm: lot.area_sqm,
          issue: "Empty Geometry Array",
          issueType: "UNMAPPED",
          severity: "warning",
          description: "Empty array saved in coordinates.",
        });
        continue;
      }

      if (parsed.length === 2 && typeof parsed[0] === "number" && typeof parsed[1] === "number") {
        pointOnlyCount += 1;
        mappedCount += 1;
        propertyMap[propId].mappedLots += 1;
      } else if (parsed.length >= 3 && Array.isArray(parsed[0])) {
        const hasInvalidPoints = parsed.some(
          (pt) => !Array.isArray(pt) || pt.length < 2 || isNaN(Number(pt[0])) || isNaN(Number(pt[1]))
        );
        if (hasInvalidPoints) {
          corruptedCount += 1;
          propertyMap[propId].corruptedLots += 1;
          flaggedLots.push({
            lotId: lot.lot_id,
            propertyId: lot.property_id,
            propertyName: lot.property_name || "Unknown",
            lotNumber: lot.lot_number,
            status: lot.status,
            areaSqm: lot.area_sqm,
            issue: "Invalid Vertex Point",
            issueType: "CORRUPTED",
            severity: "danger",
            description: "Polygon array contains non-numeric latitude/longitude vertices.",
          });
        } else {
          polygonCount += 1;
          mappedCount += 1;
          propertyMap[propId].mappedLots += 1;
        }
      } else {
        corruptedCount += 1;
        propertyMap[propId].corruptedLots += 1;
        flaggedLots.push({
          lotId: lot.lot_id,
          propertyId: lot.property_id,
          propertyName: lot.property_name || "Unknown",
          lotNumber: lot.lot_number,
          status: lot.status,
          areaSqm: lot.area_sqm,
          issue: "Incomplete Polygon",
          issueType: "CORRUPTED",
          severity: "warning",
          description: "Polygon has fewer than 3 vertices.",
        });
      }
    }

    const propertyBreakdown = Object.values(propertyMap).map((p) => ({
      ...p,
      coveragePct: p.totalLots > 0 ? Math.round((p.mappedLots / p.totalLots) * 100) : 0,
    }));

    const overallCoveragePct = totalLots > 0 ? Math.round((mappedCount / totalLots) * 100) : 0;

    res.json({
      success: true,
      totalLots,
      mappedCount,
      unmappedCount,
      corruptedCount,
      polygonCount,
      pointOnlyCount,
      overallCoveragePct,
      propertyBreakdown,
      flaggedLots,
      scannedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Map diagnostics error:", err);
    res.status(500).json({ error: "Failed to run map diagnostics", message: err.message });
  }
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

// Export helper utilities and middleware for other developer sub-controllers and router
exports.requireDeveloper = requireDeveloper;
exports.devPinRateLimiter = devPinRateLimiter;
exports.getActiveDeveloperPin = getActiveDeveloperPin;
exports.readSystemStateFile = readSystemStateFile;
exports.updateSystemStateFile = updateSystemStateFile;
