const nodemailer = require("nodemailer");
const db = require("../../config/database_connection");
const bcrypt = require("bcryptjs");

// =======================
// EMAIL TRANSPORTER SETUP
// =======================
const getTransporter = () => {
  const port = parseInt(process.env.EMAIL_PORT, 10) || 465;
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: port,
    secure: port === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

// =======================
// GENERATE TEMPORARY PASSWORD
// =======================
const generateTempPassword = () => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let tempPassword = "";
  for (let i = 0; i < 10; i++) {
    tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return tempPassword;
};

// =======================
// SEND EMAIL HELPER
// =======================
const sendEmail = async (to, subject, html) => {
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (error) {
    console.error("Email error:", error);
    return { success: false, error: error.message };
  }
};

// =======================
// FORGOT PASSWORD
// =======================
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check in admins table
    let [adminRows] = await db.query(
      "SELECT admin_id, email, full_name FROM admins WHERE email = ?",
      [email],
    );

    let userType = "admin";
    let userId = null;
    let userName = null;

    if (adminRows.length > 0) {
      userId = adminRows[0].admin_id;
      userName = adminRows[0].full_name;
    } else {
      // Check in employees table
      let [empRows] = await db.query(
        "SELECT employee_id, email, first_name, last_name FROM employees WHERE email = ?",
        [email],
      );

      if (empRows.length > 0) {
        userType = "employee";
        userId = empRows[0].employee_id;
        userName = `${empRows[0].first_name} ${empRows[0].last_name}`;
      }
    }

    // If user not found, still return success (security best practice - don't reveal if email exists)
    if (!userId) {
      return res.json({
        message: "If the email exists, a temporary password has been sent.",
      });
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();
    const hashedTempPassword = await bcrypt.hash(tempPassword, 10);
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Update database
    if (userType === "admin") {
      await db.query(
        "UPDATE admins SET password = ?, password_reset_required = TRUE, temp_password_expiry = ? WHERE admin_id = ?",
        [hashedTempPassword, expiry, userId],
      );
    } else {
      await db.query(
        "UPDATE employees SET password = ?, password_reset_required = TRUE, temp_password_expiry = ? WHERE employee_id = ?",
        [hashedTempPassword, expiry, userId],
      );
    }

    // Send email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Golden Dragon Estate Corporation - Password Reset</h2>
        <p>Hello ${userName},</p>
        <p>You requested a password reset. Here is your temporary password:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <strong style="font-size: 18px; color: #1f2937;">${tempPassword}</strong>
        </div>
        <p>This temporary password will expire in <strong>24 hours</strong>.</p>
        <p>After logging in with this temporary password, you will be required to set a new password.</p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          If you did not request this password reset, please contact your administrator immediately.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 12px;">
          Golden Dragon Estate Platform<br>
          This is an automated message, please do not reply.
        </p>
      </div>
    `;

    const emailResult = await sendEmail(
      email,
      "Password Reset - Temporary Password",
      emailHtml,
    );

    if (!emailResult.success) {
      return res.status(500).json({
        message: "Failed to send email. Please try again later.",
      });
    }

    return res.json({
      message: "If the email exists, a temporary password has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Password reset failed" });
  }
};

// =======================
// RESET PASSWORD
// =======================
const resetPassword = async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;
    const user = req.user; // set by sessionOrToken middleware (supports session + JWT)

    if (!user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    // Update password based on user role (hashed with bcrypt)
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    if (user.role === "admin") {
      await db.query(
        "UPDATE admins SET password = ?, password_reset_required = FALSE, temp_password_expiry = NULL WHERE admin_id = ?",
        [hashedPassword, user.id],
      );
    } else if (user.role === "employee") {
      await db.query(
        "UPDATE employees SET password = ?, password_reset_required = FALSE, temp_password_expiry = NULL WHERE employee_id = ?",
        [hashedPassword, user.id],
      );
    }

    // Update session if it exists (not available in JWT-only auth)
    if (req.session?.user) {
      req.session.user.password_reset_required = false;
    }

    return res.json({ message: "Password successfully reset" });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Password reset failed" });
  }
};

module.exports = {
  forgotPassword,
  resetPassword,
};
