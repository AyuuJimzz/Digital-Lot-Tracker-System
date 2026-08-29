/**
 * Facebook Messenger Alert Service via Meta Graph API
 * Sends instant developer notifications on critical system crashes / database errors.
 */

const fs = require("fs");
const path = require("path");

let lastAlertTime = 0;
let lastAlertMessage = "";
const COOLDOWN_MS = 10 * 1000; // 10-second debounce for duplicate production errors

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

  const now = Date.now();
  const alertSignature = `${title}-${details}`;
  const isManualTest = meta.bypassDebounce || title.includes("Test") || title.includes("Simulated") || details.includes("Simulated");

  // Prevent message spamming if the exact same production error repeats rapidly within 10s
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

  const formattedMessage = 
`🚨 [GOLDEN DRAGON CRITICAL ALERT]
━━━━━━━━━━━━━━━━━━━━
⏰ Time: ${timestamp}
📌 Event: ${title}
❌ Details: ${details}
${meta.route ? `🌐 Endpoint: ${meta.route}\n` : ""}${meta.user ? `👤 Triggered by: ${meta.user}\n` : ""}${meta.ip ? `🌐 Client IP: ${meta.ip}\n` : ""}━━━━━━━━━━━━━━━━━━━━
⚠️ Please inspect the Developer Panel immediately.`;

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

module.exports = {
  sendMessengerAlert,
};
