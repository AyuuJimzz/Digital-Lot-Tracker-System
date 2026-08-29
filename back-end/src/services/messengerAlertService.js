/**
 * Facebook Messenger Alert Service via Meta Graph API
 * Sends instant developer notifications on critical system crashes / database errors.
 */

let lastAlertTime = 0;
let lastAlertMessage = "";
const COOLDOWN_MS = 30 * 1000; // 30-second debounce per duplicate error

/**
 * Send Facebook Messenger direct message alert to developer
 * @param {string} title
 * @param {string} details
 * @param {object} meta
 */
const sendMessengerAlert = async (title, details, meta = {}) => {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  const recipientId = process.env.FB_RECIPIENT_PSID;

  if (!token || !recipientId) {
    // Messenger credentials not yet configured
    return { success: false, reason: "NOT_CONFIGURED" };
  }

  const now = Date.now();
  const alertSignature = `${title}-${details}`;

  // Prevent message spamming if the exact same error repeats rapidly
  if (alertSignature === lastAlertMessage && now - lastAlertTime < COOLDOWN_MS) {
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
    const response = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${token}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: formattedMessage },
      }),
    });

    const data = await response.json();
    if (response.ok && data?.message_id) {
      console.log(`✅ [MessengerAlert] Successfully delivered alert to PSID ${recipientId} (MessageId: ${data.message_id})`);
      return { success: true, messageId: data.message_id };
    }

    console.warn("[MessengerAlert] Meta API response error:", data);
    return { success: false, error: data?.error?.message || "Meta API request failed" };
  } catch (error) {
    console.error("[MessengerAlert] Failed to dispatch alert:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendMessengerAlert,
};
