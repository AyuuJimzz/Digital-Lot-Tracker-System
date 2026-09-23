const { readSystemStateFile, updateDurableSystemStateFile } = require("./devSystemStateService");
const { addDeveloperLog, parseDevice, getClientIp } = require("../../services/loggerService");

// ── EMERGENCY GLOBAL KILL SWITCH / FORCE LOGOUT ALL ──
exports.globalKillSwitch = async (req, res) => {
  try {
    const timestamp = new Date().toISOString();
    await updateDurableSystemStateFile({ authRevocationTimestamp: timestamp });

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
    const authRevocationTimestamp = readSystemStateFile().authRevocationTimestamp || null;
    res.json({ success: true, authRevocationTimestamp });
  } catch (err) {
    res.status(500).json({ error: "Failed to get kill switch status" });
  }
};
