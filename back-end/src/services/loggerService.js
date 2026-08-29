const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "../../config/system_state.json");

// Helper to parse User-Agent into clean device & browser name
function parseDevice(userAgent = "") {
  if (!userAgent) return "Unknown Device";
  const ua = userAgent;

  let os = "Desktop";
  if (/windows nt 10/i.test(ua) || /windows/i.test(ua)) os = "Windows PC";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/ipad/i.test(ua)) os = "iPad Tablet";
  else if (/iphone/i.test(ua)) os = "iPhone";
  else if (/android/i.test(ua)) os = "Android Device";
  else if (/linux/i.test(ua)) os = "Linux";

  let browser = "Browser";
  if (/edg/i.test(ua)) browser = "Edge";
  else if (/chrome|crios/i.test(ua) && !/opr|opera/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/opr|opera/i.test(ua)) browser = "Opera";

  return `${os} · ${browser}`;
}

// Helper to extract clean IP address
function getClientIp(req) {
  if (!req) return "127.0.0.1";
  const forwarded = req.headers ? req.headers["x-forwarded-for"] : null;
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const ip = req.socket?.remoteAddress || req.ip || "127.0.0.1";
  if (ip === "::1" || ip === "::ffff:127.0.0.1") return "127.0.0.1";
  return ip.replace(/^.*:/, "");
}

// Add a structured log entry
function addDeveloperLog(eventText, meta = {}) {
  try {
    let currentState = { maintenanceMode: false, developerPin: "1234", logs: [] };
    if (fs.existsSync(configPath)) {
      try {
        currentState = JSON.parse(fs.readFileSync(configPath, "utf8"));
      } catch (err) {}
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      event: eventText,
      type: meta.type || "SYSTEM", // AUTH, MAINTENANCE, BACKUP, SECURITY, ADMIN, SYSTEM
      user: meta.user || null,
      role: meta.role || null,
      device: meta.device || null,
      ip: meta.ip || null,
    };

    const logs = [logEntry, ...(currentState.logs || [])].slice(0, 150); // Keep last 150 logs
    const updatedState = { ...currentState, logs };
    fs.writeFileSync(configPath, JSON.stringify(updatedState, null, 2), "utf8");
    return logEntry;
  } catch (e) {
    console.error("Failed to add developer log:", e);
    return null;
  }
}

// Helper to log HTTP auth actions directly from req
function logAuthEvent(req, eventText, meta = {}) {
  const device = parseDevice(req.headers ? req.headers["user-agent"] : "");
  const ip = getClientIp(req);
  return addDeveloperLog(eventText, {
    type: meta.type || "AUTH",
    device,
    ip,
    ...meta,
  });
}

module.exports = {
  addDeveloperLog,
  logAuthEvent,
  parseDevice,
  getClientIp,
};
