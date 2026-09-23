// controllers/developer/devMessengerController.js
const fs = require("fs");
const path = require("path");
const { sendMessengerAlert } = require("../../services/messengerAlertService");
const { addDeveloperLog, parseDevice, getClientIp } = require("../../services/loggerService");
const { readSystemStateFile, updateSystemStateFile } = require("./devSystemController");

// ── TEST FACEBOOK MESSENGER ALERT ──
exports.testMessengerAlert = async (req, res) => {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  const psid = process.env.FB_RECIPIENT_PSID;

  if (!token || !psid) {
    return res.status(400).json({
      error: "Messenger variables not configured",
      message: "Please set FB_PAGE_ACCESS_TOKEN and FB_RECIPIENT_PSID in your back-end/.env file first.",
      configured: false,
    });
  }

  try {
    const result = await sendMessengerAlert(
      "Developer Panel Test Alert",
      "This is a test notification verifying that Facebook Messenger integration is working properly.",
      {
        route: "POST /api/developer/test-messenger-alert",
        user: "Developer Console (Manual Trigger)",
        ip: getClientIp(req),
      }
    );

    if (result.success) {
      addDeveloperLog("Dispatched test alert to Facebook Messenger", {
        type: "SYSTEM",
        device: parseDevice(req.headers["user-agent"]),
        ip: getClientIp(req),
      });

      return res.json({
        success: true,
        message: "Test alert successfully sent to your Facebook Messenger!",
        messageId: result.messageId,
      });
    }

    return res.status(502).json({
      error: "Meta API dispatch failed",
      message: result.error || "Failed to deliver message to Messenger",
    });
  } catch (err) {
    console.error("Test messenger alert error:", err);
    res.status(500).json({ error: "Server error while testing alert", message: err.message });
  }
};

// ── FETCH RECENT MESSENGER CONVERSATIONS ──
exports.getMessengerConversations = async (req, res) => {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!token) {
    return res.status(400).json({ error: "FB_PAGE_ACCESS_TOKEN is not configured" });
  }

  try {
    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/me/conversations?fields=participants,updated_time,snippet&limit=25&access_token=${token}`
    );
    const data = await metaRes.json();

    if (!metaRes.ok || data.error) {
      return res.status(502).json({ error: data.error?.message || "Failed to fetch from Meta API" });
    }

    const state = readSystemStateFile();
    const dismissedPsids = new Set(state.dismissedMessengerPsids || []);

    const currentPsidRaw = process.env.FB_RECIPIENT_PSID || "";
    const activePsids = currentPsidRaw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const recipients = [];
    const seen = new Set();

    for (const conv of data.data || []) {
      for (const p of conv.participants?.data || []) {
        // Exclude the page itself and any dismissed/hidden users
        if (p.name !== "Golden Dragon" && !seen.has(p.id) && !dismissedPsids.has(p.id)) {
          seen.add(p.id);
          recipients.push({
            id: p.id,
            name: p.name || "Facebook User",
            email: p.email || "",
            lastActive: conv.updated_time,
            snippet: conv.snippet || "",
            isCurrent: activePsids.includes(p.id),
          });
        }
      }
    }

    res.json({
      success: true,
      recipients,
      activePsids,
      dismissedCount: dismissedPsids.size,
      currentRecipientPsid: currentPsidRaw,
    });
  } catch (err) {
    console.error("Fetch messenger conversations error:", err);
    res.status(500).json({ error: "Server error fetching conversations", message: err.message });
  }
};

// ── DISMISS / HIDE CONTACT FROM CONVERSATION SCAN ──
exports.dismissMessengerRecipient = async (req, res) => {
  const { psid, name } = req.body;
  if (!psid) {
    return res.status(400).json({ error: "psid is required" });
  }

  try {
    const cleanPsid = psid.toString().trim();
    const cleanName = name ? name.toString().trim() : "User";
    const state = readSystemStateFile();
    const dismissed = new Set(state.dismissedMessengerPsids || []);
    dismissed.add(cleanPsid);

    // Also remove from active recipient list if it was active
    let activePsids = (process.env.FB_RECIPIENT_PSID || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((id) => id !== cleanPsid);

    const finalPsidStr = activePsids.join(",");
    process.env.FB_RECIPIENT_PSID = finalPsidStr;

    updateSystemStateFile({
      dismissedMessengerPsids: Array.from(dismissed),
      messengerRecipientPsid: finalPsidStr,
      messengerRecipientCount: activePsids.length,
    });

    addDeveloperLog(`Removed/Dismissed Messenger contact from scan list: ${cleanName} (${cleanPsid})`, {
      type: "SYSTEM",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });

    return res.json({
      success: true,
      message: `Contact ${cleanName} hidden from scan list`,
      activePsids,
    });
  } catch (err) {
    console.error("Dismiss messenger recipient error:", err);
    return res.status(500).json({ error: "Failed to dismiss recipient", message: err.message });
  }
};

// ── RESTORE ALL HIDDEN MESSENGER CONTACTS ──
exports.restoreMessengerRecipients = async (req, res) => {
  try {
    updateSystemStateFile({
      dismissedMessengerPsids: [],
    });

    addDeveloperLog("Restored all hidden Messenger contacts in developer console", {
      type: "SYSTEM",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });

    return res.json({
      success: true,
      message: "Restored all hidden contacts to scan list!",
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to restore recipients", message: err.message });
  }
};

// ── TOGGLE OR SET ACTIVE MESSENGER ALERT RECIPIENT(S) ──
exports.setMessengerRecipient = async (req, res) => {
  const { psid, name, action } = req.body;
  if (!psid && !req.body.psids) {
    return res.status(400).json({ error: "psid is required" });
  }

  try {
    const currentPsidRaw = process.env.FB_RECIPIENT_PSID || "";
    let activePsids = currentPsidRaw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const cleanPsid = psid ? psid.toString().trim() : "";
    const cleanName = name ? name.toString().trim() : "Developer";

    let updatedMessage = "";
    if (action === "toggle") {
      if (activePsids.includes(cleanPsid)) {
        activePsids = activePsids.filter((id) => id !== cleanPsid);
        updatedMessage = `Removed ${cleanName} from alert broadcast list`;
      } else {
        activePsids.push(cleanPsid);
        updatedMessage = `Added ${cleanName} to alert broadcast list`;
      }
    } else {
      // Direct set or toggle if already in list
      if (!activePsids.includes(cleanPsid)) {
        activePsids.push(cleanPsid);
        updatedMessage = `Added ${cleanName} to alert receivers (${activePsids.length} active)`;
      } else {
        activePsids = activePsids.filter((id) => id !== cleanPsid);
        updatedMessage = `Removed ${cleanName} from alert receivers (${activePsids.length} remaining)`;
      }
    }

    const finalPsidStr = activePsids.join(",");

    // 1. Update runtime env
    process.env.FB_RECIPIENT_PSID = finalPsidStr;

    // 2. Persist to system_state.json
    updateSystemStateFile({
      messengerRecipientPsid: finalPsidStr,
      messengerRecipientCount: activePsids.length,
      lastModified: new Date().toISOString(),
    });

    // 3. Update .env files (root and back-end)
    const envPaths = [
      path.resolve(__dirname, "../../../.env"),
      path.resolve(__dirname, "../../../../.env"),
    ];

    envPaths.forEach((envPath) => {
      try {
        if (fs.existsSync(envPath)) {
          let envContent = fs.readFileSync(envPath, "utf8");
          if (envContent.includes("FB_RECIPIENT_PSID=")) {
            envContent = envContent.replace(/FB_RECIPIENT_PSID=.*/g, `FB_RECIPIENT_PSID=${finalPsidStr}`);
          } else {
            envContent += `\nFB_RECIPIENT_PSID=${finalPsidStr}\n`;
          }
          fs.writeFileSync(envPath, envContent, "utf8");
        }
      } catch (err) {
        console.warn("Could not write to .env:", err.message);
      }
    });

    addDeveloperLog(`Messenger alert recipients updated: ${finalPsidStr} (${activePsids.length} active)`, {
      type: "SYSTEM",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });

    return res.json({
      success: true,
      message: updatedMessage,
      activePsids,
      currentRecipientPsid: finalPsidStr,
    });
  } catch (err) {
    console.error("Set messenger recipient error:", err);
    return res.status(500).json({ error: "Failed to set recipient", message: err.message });
  }
};

// ── GET ALERT FILTER PREFERENCES ──
exports.getAlertFilters = (req, res) => {
  const state = readSystemStateFile();
  const filters = {
    criticalErrors: state.alertFilters?.criticalErrors ?? true,
    reservations: state.alertFilters?.reservations ?? true,
    authSecurity: state.alertFilters?.authSecurity ?? true,
    systemChanges: state.alertFilters?.systemChanges ?? true,
  };
  res.json({
    success: true,
    filters,
    messengerAlertsEnabled: state.messengerAlertsEnabled ?? true,
  });
};

// ── TOGGLE MASTER MESSENGER DISPATCH SWITCH (ON/OFF) ──
exports.toggleMessengerMasterSwitch = (req, res) => {
  const { enabled } = req.body;
  const isEnabled = typeof enabled === "boolean" ? enabled : true;

  updateSystemStateFile({
    messengerAlertsEnabled: isEnabled,
    lastModified: new Date().toISOString(),
  });

  addDeveloperLog(`Messenger automated dispatch set to: ${isEnabled ? "ENABLED (ON)" : "PAUSED (OFF)"}`, {
    type: "SYSTEM",
    device: parseDevice(req.headers["user-agent"]),
    ip: getClientIp(req),
  });

  res.json({
    success: true,
    messengerAlertsEnabled: isEnabled,
    message: `Messenger dispatch is now ${isEnabled ? "ENABLED" : "PAUSED"}!`,
  });
};

// ── SET ALERT FILTER PREFERENCES ──
exports.setAlertFilters = (req, res) => {
  const { filters } = req.body;
  if (!filters || typeof filters !== "object") {
    return res.status(400).json({ error: "filters object is required" });
  }

  const updatedFilters = {
    criticalErrors: Boolean(filters.criticalErrors),
    reservations: Boolean(filters.reservations),
    authSecurity: Boolean(filters.authSecurity),
    systemChanges: Boolean(filters.systemChanges),
  };

  updateSystemStateFile({
    alertFilters: updatedFilters,
    lastModified: new Date().toISOString(),
  });

  addDeveloperLog("Updated Messenger Alert notification category filters", {
    type: "SYSTEM",
    device: parseDevice(req.headers["user-agent"]),
    ip: getClientIp(req),
  });

  res.json({
    success: true,
    message: "Alert notification preferences saved successfully!",
    filters: updatedFilters,
  });
};
