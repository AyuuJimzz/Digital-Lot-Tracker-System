// controllers/employeeController.js
const db = require("../../../config/database_connection");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { sendEmail } = require("../../services/emailService");

// ============================================================
// GET ALL EMPLOYEES - View all employees with performance stats
// ============================================================
exports.getAllEmployees = async (req, res) => {
  try {
    const query = `
      SELECT 
        e.*,
        COALESCE(sales.sold_count, 0) AS lots_sold,
        COALESCE(reserves.pending_count, 0) AS lots_pending
      FROM employees e
      LEFT JOIN (
        SELECT employee_id, COUNT(*) AS sold_count 
        FROM transactions 
        GROUP BY employee_id
      ) sales ON e.employee_id = sales.employee_id
      LEFT JOIN (
        SELECT employee_id, COUNT(*) AS pending_count 
        FROM customers 
        GROUP BY employee_id
      ) reserves ON e.employee_id = reserves.employee_id
      ORDER BY e.employee_id ASC
    `;
    try {
      const [rows] = await db.query(query);
      res.json(rows);
    } catch (fallbackErr) {
      // Fallback query if employee_id column is not in transactions/customers
      const [rows] = await db.query("SELECT * FROM employees ORDER BY employee_id ASC");
      res.json(rows);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// CREATE EMPLOYEE - Add new employee (Auto-generated password & email dispatch)
// ============================================================
exports.createEmployee = async (req, res) => {
  const {
    first_name,
    last_name,
    email,
    password,
  } = req.body;

  if (!first_name || !last_name || !email) {
    return res.status(400).json({ error: "First name, last name, and email are required" });
  }

  // Generate clean, secure temporary password
  const generatedPassword =
    password?.trim() ||
    `GD-${crypto.randomBytes(3).toString("hex").toUpperCase()}!${Math.floor(100 + Math.random() * 900)}`;

  const query = `
    INSERT INTO employees
    (first_name, last_name, email, password, status, password_reset_required)
    VALUES (?, ?, ?, ?, 'active', 1)
  `;

  try {
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);
    const [result] = await db.query(query, [
      first_name.trim(),
      last_name.trim(),
      email.trim(),
      hashedPassword,
    ]);

    // Send invitation email with credentials
    const loginUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/login`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #1e293b; margin: 0;">Golden Dragon Realty</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Staff Account Invitation & Credentials</p>
        </div>
        
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">
          Hello <strong>${first_name} ${last_name}</strong>,
        </p>
        
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">
          An employee account has been created for you on the <strong>Golden Dragon Estate Platform</strong>. You can now log in using the temporary credentials below:
        </p>
        
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; color: #475569; font-size: 14px;"><strong>Email:</strong> <span style="font-family: monospace; color: #0f172a;">${email}</span></p>
          <p style="margin: 0; color: #475569; font-size: 14px;"><strong>Temporary Password:</strong> <span style="font-family: monospace; color: #2563eb; font-weight: bold; font-size: 16px;">${generatedPassword}</span></p>
        </div>
        
        <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
          🔒 <em>For your security, the system will prompt you to set your own permanent password upon your first login.</em>
        </p>
        
        <div style="text-align: center; margin: 28px 0;">
          <a href="${loginUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px;">
            Log in to Staff Portal
          </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
          If you did not expect this invitation, please contact your administrator.
        </p>
      </div>
    `;

    try {
      await sendEmail(email.trim(), "Welcome to Golden Dragon - Your Staff Credentials", emailHtml);
    } catch (emailErr) {
      console.warn("Could not dispatch welcome email:", emailErr.message);
    }

    console.log(`👥 [Employee Created] ID #${result.insertId} | "${first_name} ${last_name}" (${email})`);
    res.status(201).json({
      message: "Employee added successfully. An email with login credentials has been sent.",
      employee_id: result.insertId,
      email_sent: true,
    });
  } catch (err) {
    console.error("❌ [Create Employee Error]:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "An employee with this email already exists." });
    }
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// UPDATE EMPLOYEE - Edit employee info
// ============================================================
exports.updateEmployee = async (req, res) => {
  const { id } = req.params;
  const {
    first_name,
    last_name,
    email,
  } = req.body;

  const query = `
    UPDATE employees
    SET first_name = ?, last_name = ?, email = ?
    WHERE employee_id = ?
  `;

  try {
    const [result] = await db.query(query, [
      first_name,
      last_name,
      email,
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    console.log(`👥 [Employee Updated] ID #${id} | "${first_name} ${last_name}" (${email})`);
    res.json({ message: "Employee updated successfully" });
  } catch (err) {
    console.error(`❌ [Update Employee Error] ID #${id}:`, err);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// DELETE EMPLOYEE - Delete employee
// ============================================================
exports.deleteEmployee = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query(
      "DELETE FROM employees WHERE employee_id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    console.log(`🗑️ [Employee Deleted] ID #${id}`);
    res.json({ message: "Employee deleted successfully" });
  } catch (err) {
    console.error(`❌ [Delete Employee Error] ID #${id}:`, err);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GET EMPLOYEE ACTIVITIES - Activity timeline / Audit log
// ============================================================
exports.getEmployeeActivities = async (req, res) => {
  const { id } = req.params;

  try {
    const [empRows] = await db.query("SELECT * FROM employees WHERE employee_id = ?", [id]);
    if (!empRows.length) {
      return res.status(404).json({ error: "Employee not found" });
    }
    const emp = empRows[0];

    const activities = [];

    // 1. Transactions / Lot Sales (ONLY for lots that are actually SOLD)
    try {
      const [txRows] = await db.query(
        `SELECT t.*, l.lot_number, l.status as lot_status, p.property_name, c.full_name AS customer_name, c.customer_status 
         FROM transactions t
         JOIN lots l ON t.lot_id = l.lot_id
         JOIN properties p ON l.property_id = p.property_id
         LEFT JOIN customers c ON t.customer_id = c.customer_id
         WHERE t.employee_id = ? AND (l.status = 'Sold' OR c.customer_status = 'Sold')
         ORDER BY t.transaction_date DESC LIMIT 50`,
        [id]
      );

      for (const tx of txRows) {
        activities.push({
          id: `tx-${tx.transaction_id}`,
          type: "SALE",
          title: `Marked Lot ${tx.lot_number} as Sold`,
          description: `Processed ${tx.payment_type || "Cash"} sale for buyer ${tx.customer_name || "Customer"} (${tx.property_name})`,
          timestamp: tx.transaction_date || tx.created_at,
          icon: "CheckCircle",
          color: "rose",
        });
      }
    } catch (_) {}

    // 2. Reservations & Cancellations
    try {
      const [custRows] = await db.query(
        `SELECT c.*, l.lot_number, l.status as lot_status, p.property_name 
         FROM customers c
         JOIN lots l ON c.lot_id = l.lot_id
         JOIN properties p ON l.property_id = p.property_id
         WHERE c.employee_id = ?
         ORDER BY c.created_at DESC LIMIT 50`,
        [id]
      );

      for (const cust of custRows) {
        const rawStatus = String(cust.customer_status || cust.lot_status || "").toLowerCase();
        const isCancelled = rawStatus === "cancelled" || cust.lot_status === "Available";
        const isPending = (rawStatus === "pending" || cust.lot_status === "Pending") && !isCancelled;

        if (isCancelled) {
          activities.push({
            id: `cust-cancel-${cust.customer_id}`,
            type: "CANCELLATION",
            title: `Cancelled Reservation for Lot ${cust.lot_number}`,
            description: `Reservation cancelled for buyer ${cust.full_name || "Customer"} at ${cust.property_name}`,
            timestamp: cust.updated_at || cust.created_at,
            icon: "XCircle",
            color: "orange",
          });
        } else if (isPending) {
          activities.push({
            id: `cust-res-${cust.customer_id}`,
            type: "RESERVATION",
            title: `Added Reservation for Lot ${cust.lot_number}`,
            description: `Reserved for buyer ${cust.full_name || "Customer"} at ${cust.property_name}`,
            timestamp: cust.created_at,
            icon: "Clock",
            color: "amber",
          });
        }
      }
    } catch (_) {}

    // Sort descending by timestamp
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      employee: {
        id: emp.employee_id,
        name: `${emp.first_name} ${emp.last_name}`,
        email: emp.email,
        status: emp.status,
        last_login: emp.last_login,
      },
      activities,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
