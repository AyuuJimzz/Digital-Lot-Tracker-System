const nodemailer = require("nodemailer");

// Nodemailer SMTP fallback transporter
const getTransporter = () => {
  const isGmail =
    (process.env.EMAIL_HOST || "").includes("gmail") ||
    (process.env.EMAIL_USER || "").includes("gmail");

  if (isGmail) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  const port = parseInt(process.env.EMAIL_PORT, 10) || 465;
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: port,
    secure: port === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: false,
    },
  });
};

/**
 * Universal Send Email function
 *
 * 1. Primary: Brevo HTTPS REST API (Port 443 - works on all cloud providers without port restrictions)
 * 2. Secondary: Nodemailer SMTP (local / direct SMTP)
 */
const sendEmail = async (toOrOptions, subjectParam, htmlParam, fromParam) => {
  let to, subject, html, from;
  if (typeof toOrOptions === "object" && !Array.isArray(toOrOptions)) {
    to = toOrOptions.to;
    subject = toOrOptions.subject;
    html = toOrOptions.html;
    from = toOrOptions.from;
  } else {
    to = toOrOptions;
    subject = subjectParam;
    html = htmlParam;
    from = fromParam;
  }

  const brevoApiKey = process.env.BREVO_API_KEY;

  // 1. Prioritize Brevo HTTPS REST API
  if (brevoApiKey) {
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
        return { success: true, method: "brevo", id: data.messageId };
      }

      console.warn("[EmailService] Brevo returned non-ok response, trying fallback:", data);
    } catch (brevoErr) {
      console.warn("[EmailService] Brevo API error, trying SMTP fallback:", brevoErr.message);
    }
  }

  // 2. Fallback to Nodemailer SMTP
  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    try {
      const transporter = getTransporter();
      const fromAddress =
        from ||
        process.env.EMAIL_FROM ||
        process.env.EMAIL_USER ||
        "Golden Dragon Estate Corporation <goldendragonestate@gmail.com>";

      const info = await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
      });

      console.log(`✅ [EmailService] SMTP delivered email to ${to} (ID: ${info.messageId})`);
      return { success: true, method: "smtp", id: info.messageId };
    } catch (smtpErr) {
      console.error("[EmailService] SMTP fallback error:", smtpErr.message);
      return { success: false, error: smtpErr.message };
    }
  }

  return { success: false, error: "No email service configured." };
};

module.exports = {
  sendEmail,
  getTransporter,
};
