const { Resend } = require("resend");
const nodemailer = require("nodemailer");

// Resend client (HTTPS Web API - bypasses all cloud port blocking)
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    return new Resend(apiKey);
  }
  return null;
};

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
 * Supports both:
 * 1. sendEmail(to, subject, html, from)
 * 2. sendEmail({ to, subject, html, from })
 *
 * Prioritizes Resend HTTPS API, falls back seamlessly to Nodemailer SMTP
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

  const resend = getResendClient();

  // 1. Try Resend HTTPS API first
  if (resend) {
    try {
      const fromAddress =
        from ||
        process.env.RESEND_FROM ||
        "Golden Dragon Estate <onboarding@resend.dev>";

      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      });

      if (!error && data?.id) {
        console.log(`✅ [EmailService] Resend delivered email to ${to} (ID: ${data.id})`);
        return { success: true, method: "resend", id: data.id };
      }

      console.warn("[EmailService] Resend returned error, attempting SMTP fallback...", error);
    } catch (resendErr) {
      console.warn("[EmailService] Resend API failed, falling back to SMTP:", resendErr.message);
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
