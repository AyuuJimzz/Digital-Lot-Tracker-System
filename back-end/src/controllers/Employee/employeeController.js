// controllers/employeeController.js
const db = require("../../../config/database_connection");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { sendEmail } = require("../../services/emailService");
const { clearCachedSession } = require("../../services/sessionManager");

// ============================================================
// GET ALL EMPLOYEES - View all employees with performance stats
// ============================================================
exports.getAllEmployees = async (req, res) => {
  try {
    const query = `
      SELECT
        e.employee_id,
        e.first_name,
        e.last_name,
        e.email,
        e.status,
        e.password_reset_required,
        e.last_login,
        e.created_at,
        COALESCE(sales.sold_count, 0) AS lots_sold,
        COALESCE(reserves.pending_count, 0) AS lots_pending
      FROM employees e
      LEFT JOIN (
        SELECT t.employee_id, COUNT(*) AS sold_count
        FROM transactions t
        JOIN lots l ON t.lot_id = l.lot_id
        LEFT JOIN customers c ON t.customer_id = c.customer_id
        WHERE c.customer_status = 'Sold'
           OR (t.customer_id IS NULL AND l.status = 'Sold')
        GROUP BY t.employee_id
      ) sales ON e.employee_id = sales.employee_id
      LEFT JOIN (
        SELECT c.employee_id, COUNT(DISTINCT c.lot_id) AS pending_count
        FROM customers c
        JOIN lots l ON c.lot_id = l.lot_id
        WHERE l.status = 'Pending'
          AND (c.customer_status = 'Pending' OR c.customer_status IS NULL)
          AND c.customer_id = (
            SELECT latest.customer_id FROM customers latest
            WHERE latest.lot_id = c.lot_id
            ORDER BY latest.updated_at DESC, latest.customer_id DESC LIMIT 1
          )
        GROUP BY c.employee_id
      ) reserves ON e.employee_id = reserves.employee_id
      ORDER BY e.employee_id ASC
    `;
    try {
      const [rows] = await db.query(query);
      res.json(rows);
    } catch (fallbackErr) {
      // Fallback query if employee_id column is not in transactions/customers
      const [rows] = await db.query("SELECT employee_id, first_name, last_name, email, status, password_reset_required, last_login, created_at FROM employees ORDER BY employee_id ASC");
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

    // Account creation is the critical operation. Dispatch the invitation
    // without making the successful database insert wait on Brevo.
    void sendEmail(email.trim(), "Welcome to Golden Dragon - Your Staff Credentials", emailHtml)
      .then((result) => {
        if (!result.success) console.warn("Could not dispatch welcome email:", result.error);
      })
      .catch((emailErr) => console.warn("Could not dispatch welcome email:", emailErr.message));

    console.log(`👥 [Employee Created] ID #${result.insertId} | "${first_name} ${last_name}" (${email})`);
    res.status(201).json({
      message: "Employee added successfully. Invitation email dispatch has started.",
      employee_id: result.insertId,
      email_dispatch_started: true,
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
    status,
  } = req.body;

  const validStatus = status && ["active", "inactive"].includes(String(status).toLowerCase())
    ? String(status).toLowerCase()
    : undefined;

  let query = "UPDATE employees SET first_name = ?, last_name = ?, email = ?";
  const params = [first_name, last_name, email];

  if (validStatus !== undefined) {
    query += ", status = ?";
    params.push(validStatus);
  }
  if (validStatus === "inactive") query += ", active_session_id = NULL";

  query += " WHERE employee_id = ?";
  params.push(id);

  try {
    if (validStatus === "inactive") clearCachedSession("employee", id);
    const [result] = await db.query(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    console.log(`👥 [Employee Updated] ID #${id} | "${first_name} ${last_name}" (${email})${validStatus ? ` | Status: ${validStatus}` : ""}`);
    res.json({ message: "Employee updated successfully" });
  } catch (err) {
    console.error(`❌ [Update Employee Error] ID #${id}:`, err);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// TOGGLE EMPLOYEE STATUS - Set active / inactive
// ============================================================
exports.toggleEmployeeStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !["active", "inactive"].includes(String(status).toLowerCase())) {
    return res.status(400).json({ error: "Status must be 'active' or 'inactive'" });
  }

  const newStatus = String(status).toLowerCase();

  try {
    if (newStatus === "inactive") clearCachedSession("employee", id);
    const [result] = await db.query(
      `UPDATE employees SET status = ?,
       active_session_id = CASE WHEN ? = 'inactive' THEN NULL ELSE active_session_id END
       WHERE employee_id = ?`,
      [newStatus, newStatus, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    console.log(`⏸️ [Employee Status Changed] ID #${id} -> status: ${newStatus}`);
    res.json({
      success: true,
      message: `Employee marked as ${newStatus} successfully`,
      status: newStatus,
    });
  } catch (err) {
    console.error(`❌ [Toggle Status Error] ID #${id}:`, err);
    res.status(500).json({ error: err.message });
  }
};


// ============================================================
// DELETE EMPLOYEE - Delete employee
// ============================================================
exports.deleteEmployee = async (req, res) => {
  const { id } = req.params;

  try {
    const [[references]] = await db.query(
      `SELECT (SELECT COUNT(*) FROM customers WHERE employee_id = ?) AS customer_count,
              (SELECT COUNT(*) FROM transactions WHERE employee_id = ?) AS transaction_count`,
      [id, id]
    );
    if (Number(references.customer_count) > 0 || Number(references.transaction_count) > 0) {
      return res.status(409).json({
        error: "This employee has client or sales history. Deactivate the account instead to preserve attribution.",
      });
    }
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
    const [empRows] = await db.query(
      "SELECT employee_id, first_name, last_name, email, status, password_reset_required FROM employees WHERE employee_id = ?",
      [id]
    );
    if (!empRows.length) {
      return res.status(404).json({ error: "Employee not found" });
    }
    const emp = empRows[0];

    const activities = [];

    // 1. Transactions / Lot Sales (ONLY for lots that are actually SOLD)
    try {
      const [txRows] = await db.query(
        `SELECT t.transaction_id, t.payment_type, t.transaction_date, t.created_at,
                l.lot_number, p.property_name, c.full_name AS customer_name
         FROM transactions t
         JOIN lots l ON t.lot_id = l.lot_id
         JOIN properties p ON l.property_id = p.property_id
         LEFT JOIN customers c ON t.customer_id = c.customer_id
         WHERE t.employee_id = ? AND (c.customer_status = 'Sold' OR (t.customer_id IS NULL AND l.status = 'Sold'))
         ORDER BY t.transaction_date DESC LIMIT 50`,
        [id]
      );

      for (const tx of txRows) {
        activities.push({
          id: `tx-${tx.transaction_id}`,
          type: "SALE",
          title: `Marked Lot ${tx.lot_number} as Sold`,
          description: `Processed ${tx.payment_type || "Cash"} sale for buyer ${tx.customer_name || "Customer"} (${tx.property_name})`,
          lot_number: tx.lot_number,
          property_name: tx.property_name,
          customer_name: tx.customer_name,
          payment_type: tx.payment_type,
          timestamp: tx.transaction_date || tx.created_at,
          icon: "CheckCircle",
          color: "rose",
        });
      }
    } catch (_) {}

    // 2. Reservations & Cancellations
    try {
      const [custRows] = await db.query(
        `SELECT c.customer_id, c.full_name, c.customer_status, c.created_at, c.updated_at,
                l.lot_number, l.status AS lot_status, p.property_name
         FROM customers c
         JOIN lots l ON c.lot_id = l.lot_id
         JOIN properties p ON l.property_id = p.property_id
         WHERE c.employee_id = ?
         ORDER BY c.created_at DESC LIMIT 50`,
        [id]
      );

      for (const cust of custRows) {
        const rawStatus = String(cust.customer_status || cust.lot_status || "").toLowerCase();
        const isCancelled = rawStatus === "cancelled";
        const isPending = rawStatus === "pending" && cust.lot_status === "Pending";

        if (isCancelled) {
          activities.push({
            id: `cust-cancel-${cust.customer_id}`,
            type: "CANCELLATION",
            title: `Cancelled Reservation for Lot ${cust.lot_number}`,
            description: `Reservation cancelled for buyer ${cust.full_name || "Customer"} at ${cust.property_name}`,
            lot_number: cust.lot_number,
            property_name: cust.property_name,
            customer_name: cust.full_name,
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
            lot_number: cust.lot_number,
            property_name: cust.property_name,
            customer_name: cust.full_name,
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

// ============================================================
// GET EMPLOYEE PENDING LOTS - Pending reservations for turnover
// ============================================================
exports.getEmployeePendingLots = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT
        l.lot_id,
        l.lot_number,
        p.property_name,
        c.customer_id,
        c.full_name AS customer_name,
        c.contact_number,
        c.customer_status
      FROM lots l
      JOIN properties p ON l.property_id = p.property_id
      LEFT JOIN (
        SELECT customer_id, lot_id, full_name, contact_number, customer_status, employee_id,
               ROW_NUMBER() OVER (PARTITION BY lot_id ORDER BY updated_at DESC, customer_id DESC) AS rn
        FROM customers
        WHERE lot_id IS NOT NULL
      ) c ON l.lot_id = c.lot_id AND c.rn = 1
      WHERE l.status = 'Pending'
        AND (c.customer_status = 'Pending' OR c.customer_status IS NULL)
        AND c.employee_id = ?
      ORDER BY p.property_name ASC, l.lot_number ASC
    `;

    const [rows] = await db.query(query, [id]);
    res.json(rows);
  } catch (err) {
    console.error(`❌ [Get Pending Lots Error] Employee ID #${id}:`, err);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// REASSIGN PENDING LOTS - Batch transfer pending reservations
// ============================================================
exports.reassignPendingLots = async (req, res) => {
  const { id: sourceEmployeeId } = req.params;
  const { reassignments } = req.body;

  if (!Number.isInteger(Number(sourceEmployeeId)) || Number(sourceEmployeeId) <= 0) {
    return res.status(400).json({ error: "Invalid source employee" });
  }
  if (!Array.isArray(reassignments) || reassignments.length === 0) {
    return res.status(400).json({ error: "No reassignments provided" });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const seenLotIds = new Set();

    for (const item of reassignments) {
      const { lot_id, customer_id, target_employee_id } = item || {};
      const lotId = Number(lot_id);
      if (!Number.isInteger(lotId) || lotId <= 0 || seenLotIds.has(lotId)) {
        const error = new Error("Each lot must have a unique valid ID");
        error.status = 400;
        throw error;
      }
      seenLotIds.add(lotId);

      // Lock and validate every lot; one invalid item rolls back the whole batch.
      const [lotRows] = await connection.query(
        "SELECT status FROM lots WHERE lot_id = ? FOR UPDATE",
        [lotId]
      );
      if (!lotRows.length || lotRows[0].status !== "Pending") {
        const error = new Error(`Lot ${lotId} is not Pending; no reservations were transferred`);
        error.status = 409;
        throw error;
      }

      const [customerRows] = await connection.query(
        `SELECT customer_id, employee_id, customer_status FROM customers
         WHERE lot_id = ? ORDER BY updated_at DESC, customer_id DESC LIMIT 1 FOR UPDATE`,
        [lotId]
      );
      const customer = customerRows[0];
      if (!customer || !["Pending", null].includes(customer.customer_status) ||
          Number(customer.employee_id) !== Number(sourceEmployeeId) ||
          (customer_id != null && Number(customer_id) !== Number(customer.customer_id))) {
        const error = new Error(`Lot ${lotId} is not an active reservation of this employee`);
        error.status = 409;
        throw error;
      }

      let newAgentName = "Admin";
      let validTargetEmpId = null;
      if (target_employee_id !== null && target_employee_id !== "") {
        const targetId = Number(target_employee_id);
        if (!Number.isInteger(targetId) || targetId <= 0 || targetId === Number(sourceEmployeeId)) {
          const error = new Error("Choose a different active employee or Admin as the target");
          error.status = 400;
          throw error;
        }
        const [empRows] = await connection.query(
          "SELECT employee_id, first_name, last_name FROM employees WHERE employee_id = ? AND status = 'active' FOR UPDATE",
          [targetId]
        );
        if (!empRows.length) {
          const error = new Error(`Target employee ${targetId} is not active`);
          error.status = 400;
          throw error;
        }
        validTargetEmpId = empRows[0].employee_id;
        newAgentName = `${empRows[0].first_name} ${empRows[0].last_name || ""}`.trim() || "Agent";
      }

      await connection.query(
        "UPDATE customers SET employee_id = ?, updated_at = NOW() WHERE customer_id = ?",
        [validTargetEmpId, customer.customer_id]
      );

      const [transactionRows] = await connection.query(
        `SELECT transaction_id FROM transactions WHERE lot_id = ? AND customer_id = ? FOR UPDATE`,
        [lotId, customer.customer_id]
      );
      if (transactionRows.length) {
        await connection.query(
          "UPDATE transactions SET employee_id = ?, agent_name = ? WHERE lot_id = ? AND customer_id = ?",
          [validTargetEmpId, newAgentName, lotId, customer.customer_id]
        );
      } else {
        await connection.query(
          `INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, agent_name, transaction_date)
           VALUES (?, ?, 'No Downpayment', 'Reservation transfer', ?, ?, NOW())`,
          [lotId, customer.customer_id, validTargetEmpId, newAgentName]
        );
      }
    }

    await connection.commit();
    console.log(`🔄 [Pending Lots Reassigned] Source Employee #${sourceEmployeeId} -> ${seenLotIds.size} lot(s) successfully transferred`);
    res.json({
      success: true,
      message: `Successfully reassigned ${seenLotIds.size} pending reservation(s).`,
      reassignedCount: seenLotIds.size,
    });
  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) {
        console.error("Failed to roll back employee reassignment:", rollbackError);
      }
    }
    if (!err.status) console.error(`❌ [Reassign Error] Employee #${sourceEmployeeId}:`, err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to reassign pending reservations" });
  } finally {
    if (connection) connection.release();
  }
};
