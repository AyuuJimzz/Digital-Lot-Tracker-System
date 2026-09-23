// controllers/developer/devAccountsController.js
const bcrypt = require("bcryptjs");
const db = require("../../../config/database_connection");
const { addDeveloperLog, parseDevice, getClientIp } = require("../../services/loggerService");

// ── GET ADMIN ACCOUNTS LIST ──
exports.getAdmins = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT admin_id, full_name, email FROM admins ORDER BY admin_id ASC");
    res.json({ success: true, admins: rows });
  } catch (err) {
    console.error("Fetch admins error:", err);
    res.status(500).json({ error: "Failed to fetch admin accounts" });
  }
};

// ── CREATE NEW ADMIN ACCOUNT ──
exports.createAdmin = async (req, res) => {
  const { full_name, email, password } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ error: "Full name, email, and password are required" });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = full_name.trim();

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    // Check if email already exists in admins or employees
    const [existingAdmin] = await db.query("SELECT admin_id FROM admins WHERE LOWER(email) = ?", [cleanEmail]);
    if (existingAdmin.length > 0) {
      return res.status(409).json({ error: "An admin with this email already exists" });
    }

    const [existingEmp] = await db.query("SELECT employee_id FROM employees WHERE LOWER(email) = ?", [cleanEmail]);
    if (existingEmp.length > 0) {
      return res.status(409).json({ error: "This email is already registered as an employee" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      "INSERT INTO admins (full_name, email, password, password_reset_required) VALUES (?, ?, ?, FALSE)",
      [cleanName, cleanEmail, hashedPassword]
    );

    addDeveloperLog(`Created new admin: ${cleanEmail} (${cleanName})`, {
      type: "ADMIN",
      user: cleanEmail,
      role: "admin",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });
    res.json({
      success: true,
      message: "Admin account created successfully",
      admin: {
        admin_id: result.insertId,
        full_name: cleanName,
        email: cleanEmail,
      },
    });
  } catch (err) {
    console.error("Create admin error:", err);
    res.status(500).json({ error: "Failed to create admin account", message: err.message });
  }
};

// ── RESET ADMIN PASSWORD (DEVELOPER OVERRIDE) ──
exports.resetAdminPassword = async (req, res) => {
  const { admin_id, new_password } = req.body;

  if (!admin_id || !new_password) {
    return res.status(400).json({ error: "admin_id and new_password are required" });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    const hashedPassword = await bcrypt.hash(new_password, 10);
    const [result] = await db.query(
      "UPDATE admins SET password = ? WHERE admin_id = ?",
      [hashedPassword, admin_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Admin not found" });
    }

    addDeveloperLog(`Developer override reset password for admin ID #${admin_id}`, {
      type: "SECURITY",
      role: "admin",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });
    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    console.error("Reset admin password error:", err);
    res.status(500).json({ error: "Failed to reset admin password" });
  }
};

// ── UPDATE ADMIN PROFILE (FULL NAME & EMAIL) ──
exports.updateAdmin = async (req, res) => {
  const { admin_id, full_name, email } = req.body;

  if (!admin_id || !full_name || !email) {
    return res.status(400).json({ error: "admin_id, full_name, and email are required" });
  }

  const cleanName = full_name.trim();
  const cleanEmail = email.trim().toLowerCase();

  try {
    // Check if another admin already uses this email
    const [existingAdmin] = await db.query(
      "SELECT admin_id FROM admins WHERE LOWER(email) = ? AND admin_id != ?",
      [cleanEmail, admin_id]
    );
    if (existingAdmin.length > 0) {
      return res.status(409).json({ error: "Another admin is already using this email" });
    }

    // Check employees table
    const [existingEmp] = await db.query(
      "SELECT employee_id FROM employees WHERE LOWER(email) = ?",
      [cleanEmail]
    );
    if (existingEmp.length > 0) {
      return res.status(409).json({ error: "This email is registered to an employee account" });
    }

    const [result] = await db.query(
      "UPDATE admins SET full_name = ?, email = ? WHERE admin_id = ?",
      [cleanName, cleanEmail, admin_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Admin not found" });
    }

    addDeveloperLog(`Updated admin profile #${admin_id}: ${cleanName} (${cleanEmail})`, {
      type: "ADMIN",
      user: cleanEmail,
      role: "admin",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });
    res.json({
      success: true,
      message: "Admin details updated successfully",
      admin: { admin_id, full_name: cleanName, email: cleanEmail },
    });
  } catch (err) {
    console.error("Update admin error:", err);
    res.status(500).json({ error: "Failed to update admin account", message: err.message });
  }
};

// ── DELETE ADMIN ACCOUNT ──
exports.deleteAdmin = async (req, res) => {
  const { admin_id } = req.params;

  try {
    const [adminsCount] = await db.query("SELECT COUNT(*) as total FROM admins");
    if (adminsCount[0].total <= 1) {
      return res.status(400).json({
        error: "Cannot delete the only remaining admin account. System requires at least 1 active admin.",
      });
    }

    const [result] = await db.query("DELETE FROM admins WHERE admin_id = ?", [admin_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Admin not found" });
    }

    addDeveloperLog(`Deleted admin account ID #${admin_id}`, {
      type: "ADMIN",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });
    res.json({ success: true, message: "Admin account deleted successfully" });
  } catch (err) {
    console.error("Delete admin error:", err);
    res.status(500).json({ error: "Failed to delete admin account", message: err.message });
  }
};

// ── GET EMPLOYEE ACCOUNTS LIST ──
exports.getEmployees = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT employee_id, first_name, last_name, email, status, last_login FROM employees ORDER BY employee_id ASC"
    );
    res.json({ success: true, employees: rows });
  } catch (err) {
    console.error("Fetch employees error:", err);
    res.status(500).json({ error: "Failed to fetch employee accounts" });
  }
};

// ── CREATE / PROVISION EMPLOYEE ACCOUNT ──
exports.createEmployee = async (req, res) => {
  const { first_name, last_name, email, password } = req.body;

  if (!first_name || !last_name || !email || !password) {
    return res.status(400).json({ error: "First name, last name, email, and password are required" });
  }

  const cleanFirstName = first_name.trim();
  const cleanLastName = last_name.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();

  if (cleanPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long" });
  }

  try {
    // Check if email already exists in admins or employees
    const [existingAdmin] = await db.query("SELECT admin_id FROM admins WHERE LOWER(email) = ?", [cleanEmail]);
    if (existingAdmin.length > 0) {
      return res.status(409).json({ error: "An administrator account already uses this email address" });
    }

    const [existingEmp] = await db.query("SELECT employee_id FROM employees WHERE LOWER(email) = ?", [cleanEmail]);
    if (existingEmp.length > 0) {
      return res.status(409).json({ error: "An employee with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);
    const [result] = await db.query(
      `INSERT INTO employees (first_name, last_name, email, password, status, password_reset_required)
       VALUES (?, ?, ?, ?, 'active', 0)`,
      [
        cleanFirstName,
        cleanLastName,
        cleanEmail,
        hashedPassword,
      ]
    );

    addDeveloperLog(`Provisioned new employee account: ${cleanFirstName} ${cleanLastName} (${cleanEmail})`, {
      type: "ADMIN",
      user: cleanEmail,
      role: "employee",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });

    res.status(201).json({
      success: true,
      message: `Employee account for ${cleanFirstName} ${cleanLastName} created successfully`,
      employee: {
        employee_id: result.insertId,
        first_name: cleanFirstName,
        last_name: cleanLastName,
        email: cleanEmail,
      },
    });
  } catch (err) {
    console.error("Create employee error:", err);
    res.status(500).json({ error: "Failed to create employee account", message: err.message });
  }
};

// ── INSTANT EMPLOYEE PASSWORD OVERRIDE ──
exports.resetEmployeePassword = async (req, res) => {
  const { employee_id, newPassword } = req.body;

  if (!employee_id || !newPassword) {
    return res.status(400).json({ error: "Employee ID and new password are required" });
  }

  const cleanPassword = newPassword.toString().trim();
  if (cleanPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long" });
  }

  try {
    const [empRows] = await db.query("SELECT employee_id, first_name, last_name, email FROM employees WHERE employee_id = ?", [employee_id]);
    if (empRows.length === 0) {
      return res.status(404).json({ error: "Employee account not found" });
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);
    await db.query("UPDATE employees SET password = ? WHERE employee_id = ?", [hashedPassword, employee_id]);

    addDeveloperLog(`Overrode password for employee ${empRows[0].first_name} ${empRows[0].last_name} (${empRows[0].email})`, {
      type: "SECURITY",
      user: empRows[0].email,
      role: "employee",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });

    res.json({
      success: true,
      message: `Password for employee ${empRows[0].first_name} ${empRows[0].last_name} (${empRows[0].email}) successfully updated.`,
    });
  } catch (err) {
    console.error("Reset employee password error:", err);
    res.status(500).json({ error: "Failed to override employee password", message: err.message });
  }
};

// ── UPDATE EMPLOYEE PROFILE ──
exports.updateEmployee = async (req, res) => {
  const { employee_id, first_name, last_name, email } = req.body;

  if (!employee_id || !first_name || !last_name || !email) {
    return res.status(400).json({ error: "employee_id, first_name, last_name, and email are required" });
  }

  const cleanFirstName = first_name.trim();
  const cleanLastName = last_name.trim();
  const cleanEmail = email.trim().toLowerCase();

  try {
    // Check if another employee uses this email
    const [existingEmp] = await db.query(
      "SELECT employee_id FROM employees WHERE LOWER(email) = ? AND employee_id != ?",
      [cleanEmail, employee_id]
    );
    if (existingEmp.length > 0) {
      return res.status(409).json({ error: "Another employee is already using this email" });
    }

    // Check admins table
    const [existingAdmin] = await db.query(
      "SELECT admin_id FROM admins WHERE LOWER(email) = ?",
      [cleanEmail]
    );
    if (existingAdmin.length > 0) {
      return res.status(409).json({ error: "This email is registered to an administrator account" });
    }

    const [result] = await db.query(
      "UPDATE employees SET first_name = ?, last_name = ?, email = ? WHERE employee_id = ?",
      [cleanFirstName, cleanLastName, cleanEmail, employee_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    addDeveloperLog(`Updated employee profile #${employee_id}: ${cleanFirstName} ${cleanLastName} (${cleanEmail})`, {
      type: "ADMIN",
      user: cleanEmail,
      role: "employee",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });

    res.json({
      success: true,
      message: "Employee profile updated successfully",
      employee: {
        employee_id,
        first_name: cleanFirstName,
        last_name: cleanLastName,
        email: cleanEmail,
      },
    });
  } catch (err) {
    console.error("Update employee error:", err);
    res.status(500).json({ error: "Failed to update employee account", message: err.message });
  }
};

// ── DELETE EMPLOYEE ACCOUNT ──
exports.deleteEmployee = async (req, res) => {
  const { employee_id } = req.params;

  try {
    const [empRows] = await db.query("SELECT email, first_name, last_name FROM employees WHERE employee_id = ?", [employee_id]);
    if (empRows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    await db.query("DELETE FROM employees WHERE employee_id = ?", [employee_id]);

    addDeveloperLog(`Deleted employee account ID #${employee_id}: ${empRows[0].first_name} ${empRows[0].last_name} (${empRows[0].email})`, {
      type: "ADMIN",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });

    res.json({ success: true, message: "Employee account deleted successfully" });
  } catch (err) {
    console.error("Delete employee error:", err);
    res.status(500).json({ error: "Failed to delete employee account", message: err.message });
  }
};
