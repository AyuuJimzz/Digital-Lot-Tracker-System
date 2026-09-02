const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const db = require("../../config/database_connection");
const { sendDirectMessage } = require("../services/messengerAlertService");
const { addDeveloperLog, parseDevice, getClientIp } = require("../services/loggerService");

const configPath = path.join(__dirname, "../../config/system_state.json");

// Helper to read system_state.json
function readSystemState() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
  } catch (_) {}
  return { maintenanceMode: false, logs: [] };
}

// Helper to write to system_state.json
function updateSystemState(fields) {
  try {
    const current = readSystemState();
    const merged = { ...current, ...fields, lastModified: new Date().toISOString() };
    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), "utf8");
    return merged;
  } catch (err) {
    console.error("Failed to update system state from Messenger bot:", err);
    return null;
  }
}

// Helper to verify developer access
function requireDeveloper(req, res, next) {
  let activePin = (process.env.DEVELOPER_PIN || "1234").toString().trim();
  try {
    if (fs.existsSync(configPath)) {
      const state = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (state.developerPin) activePin = state.developerPin.toString().trim();
    }
  } catch (err) {}

  const devKey = req.headers["x-developer-pin"] || req.body?.key;
  if ((devKey && devKey.toString().trim() === activePin) || (req.session && req.session.isDeveloper)) {
    return next();
  }
  return res.status(403).json({ error: "Access Denied: Developer authentication required" });
}

/**
 * Process interactive Messenger Bot command
 * @param {string} senderPsid
 * @param {string} rawText
 */
async function handleBotCommand(senderPsid, rawText) {
  const cleanCmd = (rawText || "").trim().toUpperCase();

  const activePsids = (process.env.FB_RECIPIENT_PSID || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const isAuthorizedAdmin = activePsids.length === 0 || activePsids.includes(senderPsid);

  // 0. ID / #ID / UID (Get sender's own PSID — Publicly allowed)
  if (
    cleanCmd === "#ID" ||
    cleanCmd === "ID" ||
    cleanCmd === "UID" ||
    cleanCmd === "MY ID" ||
    cleanCmd === "MYID" ||
    cleanCmd === "PSID" ||
    cleanCmd === "MY PSID"
  ) {
    const reply = 
`🆔 [YOUR FACEBOOK MESSENGER PSID]
━━━━━━━━━━━━━━━━━━━━
🔑 Your PSID: ${senderPsid}
━━━━━━━━━━━━━━━━━━━━
💡 Ito ang iyong unique Facebook ID sa Page na ito. Maaari itong i-save sa Developer Panel para makatanggap ka ng automated production alerts!`;

    return await sendDirectMessage(senderPsid, reply);
  }

  // Guard for Privileged Administrative Commands
  if (!isAuthorizedAdmin && (cleanCmd.startsWith("MAINTENANCE") || cleanCmd === "LOGS" || cleanCmd === "ERRORS" || cleanCmd === "EVENTS" || cleanCmd === "STATUS" || cleanCmd === "PING")) {
    const reply = `🔒 [UNAUTHORIZED ACCESS]\n━━━━━━━━━━━━━━━━━━━━\nYour Facebook PSID (${senderPsid}) is not registered as an authorized developer or administrator.\n\nReply '#ID' to obtain your ID for registration.`;
    return await sendDirectMessage(senderPsid, reply);
  }

  // 1. STATUS / PING / HEALTH
  if (cleanCmd === "STATUS" || cleanCmd === "PING" || cleanCmd === "HEALTH") {
    const start = Date.now();
    let dbLatency = "N/A";
    try {
      await db.query("SELECT 1");
      dbLatency = `${Date.now() - start}ms`;
    } catch (e) {
      dbLatency = "Offline / Timeout";
    }

    const uptimeSec = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const uptimeStr = `${hours}h ${minutes}m`;

    const state = readSystemState();

    const reply = 
`🟢 [GOLDEN DRAGON LIVE STATUS]
━━━━━━━━━━━━━━━━━━━━
⏱️ Server Uptime: ${uptimeStr}
🗄️ MySQL Latency: ${dbLatency} (Aiven Cloud)
🛡️ Platform State: ${state.maintenanceMode ? "🚧 Maintenance Mode" : "✅ LIVE Operations"}
👥 Alert Receivers: ${activePsids.length} Developer Accounts Active
⚙️ Node Engine: ${process.version} · Port 5000
━━━━━━━━━━━━━━━━━━━━
💡 Reply 'LOGS' for recent events or 'HELP' for commands.`;

    return await sendDirectMessage(senderPsid, reply);
  }

  // 2. LOGS / ERRORS / EVENTS
  if (cleanCmd === "LOGS" || cleanCmd === "ERRORS" || cleanCmd === "EVENTS") {
    const state = readSystemState();
    const recentLogs = (state.logs || []).slice(0, 3);

    let logLines = recentLogs.map((l, i) => `${i + 1}. [${l.type || "INFO"}] ${l.event}`).join("\n");
    if (!logLines) logLines = "No recent events recorded.";

    const reply = 
`📋 [GOLDEN DRAGON RECENT LOGS]
━━━━━━━━━━━━━━━━━━━━
${logLines}
━━━━━━━━━━━━━━━━━━━━
💡 Reply 'STATUS' or 'HELP'.`;

    return await sendDirectMessage(senderPsid, reply);
  }

  // 3. MAINTENANCE TOGGLE VIA CHAT
  if (cleanCmd === "MAINTENANCE ON" || cleanCmd === "MAINT ON") {
    updateSystemState({ maintenanceMode: true });
    addDeveloperLog(`Maintenance mode ENABLED via Messenger Command by PSID: ${senderPsid}`, {
      type: "MAINTENANCE",
      device: "Messenger Bot",
      ip: "Meta Webhook",
    });
    const reply = `🚧 [GOLDEN DRAGON MAINTENANCE]\n━━━━━━━━━━━━━━━━━━━━\nMaintenance Mode has been ENABLED across the platform.\nUsers will now see the Under Construction page.`;
    return await sendDirectMessage(senderPsid, reply);
  }

  if (cleanCmd === "MAINTENANCE OFF" || cleanCmd === "MAINT OFF") {
    updateSystemState({ maintenanceMode: false });
    addDeveloperLog(`Maintenance mode DISABLED via Messenger Command by PSID: ${senderPsid}`, {
      type: "MAINTENANCE",
      device: "Messenger Bot",
      ip: "Meta Webhook",
    });
    const reply = `✅ [GOLDEN DRAGON LIVE]\n━━━━━━━━━━━━━━━━━━━━\nMaintenance Mode has been DISABLED.\nPlatform is now fully accessible to all admins and clients.`;
    return await sendDirectMessage(senderPsid, reply);
  }

  // 4. HELP / COMMANDS / FALLBACK MENU
  const reply = 
`🤖 [GOLDEN DRAGON BOT DIRECTORY]
━━━━━━━━━━━━━━━━━━━━
Hello! Here are the commands you can chat:

• #ID - Show your unique Facebook User PSID
• STATUS - Live Server Uptime & Database Ping
• LOGS - View recent system error & audit logs
• MAINTENANCE ON - Turn platform maintenance mode ON
• MAINTENANCE OFF - Turn platform maintenance mode OFF
• HELP - Show this command list
━━━━━━━━━━━━━━━━━━━━
⚡ Live automated response from Golden Dragon Estate Server.`;

  return await sendDirectMessage(senderPsid, reply);
}

// ── META WEBHOOK VERIFICATION HANDSHAKE ──
router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const verifyToken = process.env.FB_VERIFY_TOKEN || "golden_dragon_bot_2026";

  if (mode && token) {
    if (mode === "subscribe" && token === verifyToken) {
      console.log("✅ [MessengerWebhook] Meta Webhook verified successfully!");
      return res.status(200).send(challenge);
    }
    console.warn("❌ [MessengerWebhook] Webhook verification failed. Verify token mismatch.");
    return res.sendStatus(403);
  }
  res.sendStatus(400);
});

// ── META INCOMING MESSAGE RECEIVER ──
router.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    res.status(200).send("EVENT_RECEIVED");

    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        const senderPsid = event.sender?.id;
        const messageText = event.message?.text;

        if (senderPsid && messageText) {
          console.log(`💬 [MessengerWebhook] Received command from ${senderPsid}: "${messageText}"`);
          try {
            await handleBotCommand(senderPsid, messageText);
          } catch (cmdErr) {
            console.error("Error processing bot command:", cmdErr);
          }
        }
      }
    }
  } else {
    res.sendStatus(404);
  }
});

// ── DEVELOPER PANEL SIMULATE COMMAND TEST ──
router.post("/simulate-command", requireDeveloper, async (req, res) => {
  const { command, psid } = req.body;
  
  let targetPsids = [];
  if (psid) {
    targetPsids = [psid.toString().trim()];
  } else {
    targetPsids = (process.env.FB_RECIPIENT_PSID || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (targetPsids.length === 0) {
    return res.status(400).json({ error: "No target PSID configured or provided" });
  }

  try {
    const results = await Promise.allSettled(
      targetPsids.map((id) => handleBotCommand(id, command || "STATUS"))
    );
    const successful = results.filter((r) => r.status === "fulfilled" && r.value?.success);
    if (successful.length > 0) {
      return res.json({
        success: true,
        message: `Command '${command || "STATUS"}' executed & sent to ${successful.length} account(s)! Check your Messenger.`,
        deliveredCount: successful.length,
      });
    }
    return res.status(502).json({ error: "Failed to dispatch reply", detail: results });
  } catch (err) {
    return res.status(500).json({ error: "Simulation failed", message: err.message });
  }
});

module.exports = router;
