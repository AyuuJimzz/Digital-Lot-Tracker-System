// controllers/profileController.js
const db = require("../../config/database_connection");

exports.getProfile = async (req, res) => {
  const user = req.session?.user;
  if (!user) return res.status(401).json({ message: "Not authenticated" });

  try {
    // Whitelist for table and column names to prevent SQL injection
    const validTables = { admin: "admins", employee: "employees" };
    const validIdColumns = { admin: "admin_id", employee: "employee_id" };

    const table = validTables[user.role];
    const idColumn = validIdColumns[user.role];

    if (!table || !idColumn) {
      return res.status(400).json({ message: "Invalid user role" });
    }

    // We get role-agnostic basic info. Note: employees table might have 'first_name', 'last_name', etc.
    const [rows] = await db.query(`SELECT * FROM ${table} WHERE ${idColumn} = ?`, [user.id]);

    if (rows.length === 0) return res.status(404).json({ message: "User not found" });

    const userData = rows[0];

    // Map Admin 'full_name' to 'first_name' and 'last_name' for the frontend
    if (user.role === "admin" && userData.full_name) {
      const nameParts = userData.full_name.split(" ");
      userData.first_name = nameParts[0] || "";
      userData.last_name = nameParts.slice(1).join(" ") || "";
      delete userData.full_name;
    }

    // Don't send password
    delete userData.password;
    delete userData.temp_password_expiry;

    res.json(userData);
  } catch (err) {
    console.error("Error getting profile:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateProfile = async (req, res) => {
  const user = req.session?.user;
  if (!user) return res.status(401).json({ message: "Not authenticated" });

  const { email, first_name, last_name, phone_number } = req.body;

  try {
    // Whitelist for table and column names to prevent SQL injection
    const validTables = { admin: "admins", employee: "employees" };
    const validIdColumns = { admin: "admin_id", employee: "employee_id" };

    const table = validTables[user.role];
    const idColumn = validIdColumns[user.role];

    if (!table || !idColumn) {
      return res.status(400).json({ message: "Invalid user role" });
    }

    // Build dynamic update (since admins might not have first_name, depending on schema)
    let updates = ["email = ?"];
    let values = [email];

    if (user.role === "admin") {
      // Admins table uses 'full_name'
      const fn = first_name || "";
      const ln = last_name || "";
      const fullName = `${fn} ${ln}`.trim();

      if (fullName) {
        updates.push("full_name = ?");
        values.push(fullName);
      }
      // Note: We don't push phone_number since it's not in the admins table schema yet
    } else {
      // Employees table uses 'first_name', 'last_name', 'phone_number'
      if (first_name !== undefined) {
        updates.push("first_name = ?");
        values.push(first_name);
      }
      if (last_name !== undefined) {
        updates.push("last_name = ?");
        values.push(last_name);
      }
      if (phone_number !== undefined) {
        updates.push("phone_number = ?");
        values.push(phone_number);
      }
    }

    values.push(user.id);
    // Remove updated_at from admins if it doesn't exist, we fallback to just standard updates
    const hasUpdatedAtColumn = user.role !== "admin";

    // Some older tables don't have updated_at, safest is to just execute the updates
    const query = `UPDATE ${table} SET ${updates.join(", ")} WHERE ${idColumn} = ?`;

    await db.query(query, values);

    // Update session email
    if (req.session.user) {
      req.session.user.email = email;
    }

    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const bcrypt = require("bcryptjs");

exports.changePassword = async (req, res) => {
  const user = req.session?.user;
  if (!user) return res.status(401).json({ message: "Not authenticated" });

  const { currentPassword, newPassword } = req.body;

  try {
    // Whitelist for table and column names to prevent SQL injection
    const validTables = { admin: "admins", employee: "employees" };
    const validIdColumns = { admin: "admin_id", employee: "employee_id" };

    const table = validTables[user.role];
    const idColumn = validIdColumns[user.role];

    if (!table || !idColumn) {
      return res.status(400).json({ message: "Invalid user role" });
    }

    const [rows] = await db.query(`SELECT password FROM ${table} WHERE ${idColumn} = ?`, [user.id]);
    if (rows.length === 0) return res.status(404).json({ message: "User not found" });

    const storedPassword = rows[0].password;
    let passwordMatch = false;
    if (storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$")) {
      passwordMatch = await bcrypt.compare(currentPassword, storedPassword);
    } else {
      passwordMatch = currentPassword === storedPassword;
    }

    if (!passwordMatch) return res.status(400).json({ message: "Incorrect current password" });

    // Hash the new password with bcrypt
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query(`UPDATE ${table} SET password = ?, updated_at = NOW() WHERE ${idColumn} = ?`, [
      hashedPassword,
      user.id,
    ]);

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Error changing password:", err);
    res.status(500).json({ message: "Server error" });
  }
};
