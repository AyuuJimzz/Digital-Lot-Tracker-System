const db = require("../../config/database_connection");
const bcrypt = require("bcryptjs");
const { randomInt } = require("node:crypto");
const { sendEmail } = require("../services/emailService");
const { generateToken } = require("../utils/tokenHelper");

// =======================
// GENERATE TEMPORARY PASSWORD
// =======================
const generateTempPassword = () => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let tempPassword = "";
  for (let i = 0; i < 16; i++) {
    tempPassword += chars.charAt(randomInt(chars.length));
  }
  return tempPassword;
};

// =======================
// FORGOT PASSWORD
// =======================
const forgotPassword = async (req, res) => {
  let connection;
  let transactionOpen = false;
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

    // The password update stays uncommitted until the email provider accepts
    // the message. A failed dispatch rolls back, preserving the old login.
    connection = await db.getConnection();
    await connection.beginTransaction();
    transactionOpen = true;
    const table = userType === "admin" ? "admins" : "employees";
    const idColumn = userType === "admin" ? "admin_id" : "employee_id";
    const [updateResult] = await connection.query(
      `UPDATE ${table} SET password = ?, password_reset_required = TRUE, temp_password_expiry = ? WHERE ${idColumn} = ?`,
      [hashedTempPassword, expiry, userId],
    );
    if (updateResult.affectedRows !== 1) {
      await connection.rollback();
      transactionOpen = false;
      return res.json({
        message: "If the email exists, a temporary password has been sent.",
      });
    }

    // Send email before committing the password change.
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0f172a; color: white; padding: 20px 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 48px; vertical-align: middle;">
                <img src="https://goldendragonestate.onrender.com/golden-dragon-logo.png" alt="Golden Dragon Logo" width="44" height="44" style="display: block; border-radius: 6px;" />
              </td>
              <td style="vertical-align: middle; padding-left: 12px;">
                <h2 style="margin: 0; font-size: 17px; text-transform: uppercase; letter-spacing: 0.5px; color: #ffffff;">Golden Dragon Real Estate Corp.</h2>
                <p style="margin: 3px 0 0 0; font-size: 12px; color: #94a3b8;">Official Password Reset Request</p>
              </td>
            </tr>
          </table>
        </div>
        <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
          <p>Hello <strong>${userName}</strong>,</p>
          <p>You requested a password reset. Here is your temporary password:</p>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0; text-align: center;">
            <strong style="font-size: 20px; color: #0f172a; letter-spacing: 1px;">${tempPassword}</strong>
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
      </div>
    `;

    const emailResult = await sendEmail(
      email,
      "Password Reset - Temporary Password",
      emailHtml,
    );

    if (!emailResult.success) {
      await connection.rollback();
      transactionOpen = false;
      return res.status(500).json({
        message: "Failed to send email. Please try again later.",
      });
    }

    await connection.commit();
    transactionOpen = false;
    return res.json({
      message: "If the email exists, a temporary password has been sent.",
    });
  } catch (error) {
    if (transactionOpen) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Password reset rollback error:", rollbackError);
      }
    }
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Password reset failed" });
  } finally {
    connection?.release();
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

    const updatedUser = {
      ...user,
      password_reset_required: false,
    };
    const token = generateToken(updatedUser, user.sessionId);

    return res.json({
      message: "Password successfully reset",
      token,
      user: updatedUser,
      password_reset_required: false,
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Password reset failed" });
  }
};

module.exports = {
  forgotPassword,
  resetPassword,
};
