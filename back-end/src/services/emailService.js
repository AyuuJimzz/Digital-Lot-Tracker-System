const { addDeveloperLog } = require("./loggerService");

/**
 * Universal Email Service via Brevo HTTPS REST API
 * (Bypasses cloud host SMTP port restrictions)
 */
const sendEmail = async (toOrOptions, subjectParam, htmlParam) => {
  let to, subject, html;
  if (typeof toOrOptions === "object" && !Array.isArray(toOrOptions)) {
    to = toOrOptions.to;
    subject = toOrOptions.subject;
    html = toOrOptions.html;
  } else {
    to = toOrOptions;
    subject = subjectParam;
    html = htmlParam;
  }

  const targetEmailStr = Array.isArray(to) ? to.join(", ") : String(to || "");

  const brevoApiKey = process.env.BREVO_API_KEY;
  if (!brevoApiKey) {
    console.warn("[EmailService] BREVO_API_KEY is not defined in environment variables.");
    addDeveloperLog(`Email dispatch skipped (No API Key) to ${targetEmailStr}: "${subject || "Notification"}"`, {
      type: "EMAIL",
      user: targetEmailStr,
      role: "BREVO SMTP",
      device: "Mail Server",
    });
    return { success: false, error: "Email credentials not configured." };
  }

  try {
    const senderEmail = process.env.EMAIL_USER || "goldendragonestate@gmail.com";
    const senderName = "Golden Dragon Estate Corporation";

    const recipients = Array.isArray(to)
      ? to.map((email) => ({ email }))
      : [{ email: to }];

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: recipients,
        subject,
        htmlContent: html,
      }),
    });

    const data = await response.json();
    if (response.ok && data?.messageId) {
      console.log(`✅ [EmailService] Brevo HTTPS delivered email to ${to} (MessageId: ${data.messageId})`);
      addDeveloperLog(`Email delivered to: ${targetEmailStr} | Subject: "${subject || "Notification"}"`, {
        type: "EMAIL",
        user: targetEmailStr,
        role: "BREVO SMTP",
        device: "Mail Server",
      });
      return { success: true, method: "brevo", id: data.messageId };
    }

    console.error("[EmailService] Brevo API error response:", data);
    addDeveloperLog(`Email delivery failed to ${targetEmailStr}: ${data?.message || "Brevo Error"}`, {
      type: "EMAIL",
      user: targetEmailStr,
      role: "BREVO SMTP",
      device: "Mail Server",
    });
    return { success: false, error: data?.message || "Failed to send email via Brevo." };
  } catch (error) {
    console.error("[EmailService] Network/Fetch error:", error.message);
    addDeveloperLog(`Email network error to ${targetEmailStr}: ${error.message}`, {
      type: "EMAIL",
      user: targetEmailStr,
      role: "BREVO SMTP",
      device: "Mail Server",
    });
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmail,
};
