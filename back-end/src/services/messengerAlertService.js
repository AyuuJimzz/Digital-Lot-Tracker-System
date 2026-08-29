/**
 * Facebook Messenger Alert Service via Meta Graph API
 * Sends instant developer notifications on critical system crashes / database errors.
 */

const fs = require("fs");
const path = require("path");

let lastAlertTime = 0;
let lastAlertMessage = "";
const COOLDOWN_MS = 30 * 1000; // 30-second anti-spam debounce for duplicate production errors

const getActiveToken = () => {
  if (process.env.FB_PAGE_ACCESS_TOKEN) return process.env.FB_PAGE_ACCESS_TOKEN.trim();
  const envPaths = [
    path.resolve(__dirname, "../../.env"),
    path.resolve(__dirname, "../../../.env"),
  ];
  for (const p of envPaths) {
    try {
      if (fs.existsSync(p)) {
        const match = fs.readFileSync(p, "utf8").match(/FB_PAGE_ACCESS_TOKEN=(.*)/);
        if (match && match[1]) return match[1].trim();
      }
    } catch (_) {}
  }
  return "";
};

const getActiveRecipientPsids = () => {
  const envPsid = process.env.FB_RECIPIENT_PSID || "";
  let psids = envPsid
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (psids.length === 0) {
    try {
      const statePath = path.resolve(__dirname, "../../config/system_state.json");
      if (fs.existsSync(statePath)) {
        const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
        if (state.messengerRecipientPsid) {
          psids = state.messengerRecipientPsid.split(",").map((s) => s.trim()).filter(Boolean);
        }
      }
    } catch (_) {}
  }
  return psids;
};

const getAlertFilters = () => {
  try {
    const statePath = path.resolve(__dirname, "../../config/system_state.json");
    if (fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
      return {
        criticalErrors: state.alertFilters?.criticalErrors ?? true,
        reservations: state.alertFilters?.reservations ?? true,
        authSecurity: state.alertFilters?.authSecurity ?? true,
        systemChanges: state.alertFilters?.systemChanges ?? true,
      };
    }
  } catch (_) {}
  return {
    criticalErrors: true,
    reservations: true,
    authSecurity: true,
    systemChanges: true,
  };
};

const isMessengerAlertsEnabled = () => {
  try {
    const statePath = path.resolve(__dirname, "../../config/system_state.json");
    if (fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
      if (state.messengerAlertsEnabled !== undefined) {
        return Boolean(state.messengerAlertsEnabled);
      }
    }
  } catch (_) {}
  return true;
};

/**
 * Send Facebook Messenger direct message alert to developer(s)
 * Supports single or multi-recipient comma-separated PSIDs
 * @param {string} title
 * @param {string} details
 * @param {object} meta
 */
const sendMessengerAlert = async (title, details, meta = {}) => {
  const token = getActiveToken();
  const recipientIds = getActiveRecipientPsids();

  if (!token || recipientIds.length === 0) {
    console.warn("[MessengerAlert] Missing credentials:", { hasToken: !!token, recipientCount: recipientIds.length });
    return { success: false, reason: "NOT_CONFIGURED" };
  }

  // 1. Master Messenger Alerts Kill-Switch / Pause Toggle
  if (!isMessengerAlertsEnabled() && !meta.bypassMasterSwitch) {
    console.log(`⏸️ [MessengerAlert] Master Messenger Dispatch is DISABLED in Dev Panel. Skipping alert: ${title}`);
    return { success: false, reason: "MASTER_SWITCH_DISABLED" };
  }

  const category = meta.category || "criticalErrors";
  const filters = getAlertFilters();
  const isManualTest = meta.bypassDebounce || title.includes("Test") || title.includes("Simulated") || details.includes("Simulated");

  if (!isManualTest && filters[category] === false) {
    console.log(`🔇 [MessengerAlert] Skipped notification for '${title}' (Category '${category}' is turned off)`);
    return { success: false, reason: "CATEGORY_DISABLED", category };
  }

  const now = Date.now();
  const alertSignature = `${title}-${details}`;

  // Prevent message spamming if the exact same production error repeats rapidly within 30s
  if (!isManualTest && alertSignature === lastAlertMessage && now - lastAlertTime < COOLDOWN_MS) {
    console.log(`⏳ [MessengerAlert] Debounced duplicate error alert: ${title}`);
    return { success: false, reason: "DEBOUNCED" };
  }

  lastAlertTime = now;
  lastAlertMessage = alertSignature;

  const timestamp = new Date().toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const headerBanner = category === "reservations"
    ? "📝 [GOLDEN DRAGON RESERVATION ALERT]"
    : category === "authSecurity"
    ? "🛡️ [GOLDEN DRAGON SECURITY ALERT]"
    : category === "systemChanges"
    ? "⚙️ [GOLDEN DRAGON SYSTEM CHANGE]"
    : "🚨 [GOLDEN DRAGON CRITICAL ALERT]";

  const formattedMessage = 
`${headerBanner}
━━━━━━━━━━━━━━━━━━━━
⏰ Time: ${timestamp}
📌 Event: ${title}
❌ Details: ${details}
${meta.route ? `🌐 Endpoint: ${meta.route}\n` : ""}${meta.user ? `👤 Triggered by: ${meta.user}\n` : ""}${meta.ip ? `🌐 Client IP: ${meta.ip}\n` : ""}━━━━━━━━━━━━━━━━━━━━
⚠️ Please inspect the Developer Panel if needed.`;

  try {
    const dispatchPromises = recipientIds.map(async (rId) => {
      try {
        const response = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${token}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient: { id: rId },
            message: { text: formattedMessage },
          }),
        });

        const data = await response.json();
        if (response.ok && data?.message_id) {
          console.log(`✅ [MessengerAlert] Delivered alert to PSID ${rId} (MessageId: ${data.message_id})`);
          return { psid: rId, success: true, messageId: data.message_id };
        }
        console.warn(`[MessengerAlert] Meta response error for PSID ${rId}:`, data?.error?.message || data);
        return { psid: rId, success: false, error: data?.error?.message || "Failed" };
      } catch (err) {
        console.error(`[MessengerAlert] Failed sending to PSID ${rId}:`, err.message);
        return { psid: rId, success: false, error: err.message };
      }
    });

    const results = await Promise.allSettled(dispatchPromises);
    const delivered = results.filter((r) => r.status === "fulfilled" && r.value?.success);

    return {
      success: delivered.length > 0,
      deliveredCount: delivered.length,
      totalCount: recipientIds.length,
      results: results.map((r) => (r.status === "fulfilled" ? r.value : { error: r.reason?.message })),
    };
  } catch (error) {
    console.error("[MessengerAlert] Global dispatch error:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send direct reply to a specific user PSID (for interactive bot commands)
 * @param {string} recipientPsid
 * @param {string} text
 */
const sendDirectMessage = async (recipientPsid, text) => {
  const token = getActiveToken();
  if (!token || !recipientPsid) {
    return { success: false, reason: "NOT_CONFIGURED" };
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientPsid },
        message: { text },
      }),
    });
    const data = await response.json();
    if (response.ok && data?.message_id) {
      return { success: true, messageId: data.message_id };
    }
    return { success: false, error: data?.error?.message || "Failed" };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

module.exports = {
  sendMessengerAlert,
  sendDirectMessage,
};
