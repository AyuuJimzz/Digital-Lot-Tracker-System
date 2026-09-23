// controllers/developer/devDatabaseController.js
const bcrypt = require("bcryptjs");
const db = require("../../../config/database_connection");
const { generateBackupSql } = require("../../services/dbBackupService");
const { addDeveloperLog, parseDevice, getClientIp } = require("../../services/loggerService");

// ── DEMO STAFF CONFIGURATION CONSTANT ──
const DEMO_STAFF_CONFIG = [
  { first_name: "Sarah Mae", last_name: "Santos", email: "sarah.santos@goldendragon.com", rawPassword: "Password123!" },
  { first_name: "Mark Anthony", last_name: "Reyes", email: "mark.reyes@goldendragon.com", rawPassword: "Password123!" },
  { first_name: "Eduardo", last_name: "Ramos", email: "eduardo.ramos@goldendragon.com", rawPassword: "Password123!" },
];

// ── BACKUP DATABASE ──
exports.backupDb = async (req, res) => {
  try {
    const sqlDump = await generateBackupSql();
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `golden_dragon_backup_${dateStr}.sql`;

    res.setHeader("Content-Type", "application/sql");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    addDeveloperLog("Full database backup downloaded (.sql)", {
      type: "BACKUP",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });
    res.send(sqlDump);
  } catch (err) {
    console.error("Backup DB error:", err);
    res.status(500).json({ error: "Failed to generate database backup", message: err.message });
  }
};

// ── LIVE DATABASE TABLE & STORAGE INSPECTOR ──
exports.getDbInspector = async (req, res) => {
  try {
    const pingStart = Date.now();
    await db.query("SELECT 1");
    const latencyMs = Date.now() - pingStart;

    // Fetch information schema table stats
    const [tableStats] = await db.query(`
      SELECT 
        TABLE_NAME AS tableName,
        TABLE_ROWS AS approxRows,
        DATA_LENGTH AS dataBytes,
        INDEX_LENGTH AS indexBytes,
        (DATA_LENGTH + INDEX_LENGTH) AS totalBytes,
        CREATE_TIME AS createdAt,
        UPDATE_TIME AS updatedAt
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC
    `);

    // Helper to format byte sizes
    const formatBytes = (b) => {
      if (!b || b === 0) return "0 B";
      if (b < 1024) return `${b} B`;
      if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
      return `${(b / (1024 * 1024)).toFixed(2)} MB`;
    };

    const tables = [];
    let totalDatabaseBytes = 0;
    let totalRecordsCount = 0;

    for (const t of tableStats) {
      let exactRows = 0;
      try {
        const [[countResult]] = await db.query(`SELECT COUNT(*) AS total FROM \`${t.tableName}\``);
        exactRows = Number(countResult.total) || 0;
      } catch (err) {
        exactRows = Number(t.approxRows) || 0;
      }

      const bytes = Number(t.totalBytes) || 0;
      totalDatabaseBytes += bytes;
      totalRecordsCount += exactRows;

      tables.push({
        name: t.tableName,
        rows: exactRows,
        dataBytes: Number(t.dataBytes) || 0,
        indexBytes: Number(t.indexBytes) || 0,
        totalBytes: bytes,
        sizeFormatted: formatBytes(bytes),
        lastUpdated: t.updatedAt || t.createdAt || null,
      });
    }

    let status = "Excellent";
    let statusColor = "emerald";
    if (latencyMs > 100) {
      status = "Good";
      statusColor = "blue";
    }
    if (latencyMs > 250) {
      status = "Moderate";
      statusColor = "amber";
    }
    if (latencyMs > 500) {
      status = "High Latency";
      statusColor = "rose";
    }

    res.json({
      success: true,
      latencyMs,
      status,
      statusColor,
      databaseName: process.env.DB_NAME || "golden_dragon_db",
      totalSizeFormatted: formatBytes(totalDatabaseBytes),
      totalBytes: totalDatabaseBytes,
      totalRows: totalRecordsCount,
      tableCount: tables.length,
      tables,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("DB Inspector error:", err);
    res.status(500).json({ error: "Failed to inspect database", message: err.message });
  }
};

// ── GET TABLE DATA ROWS (TABLE DATA EXPLORER) ──
exports.getTableData = async (req, res) => {
  const { tableName } = req.params;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Number(req.query.offset) || 0;

  try {
    // 1. Verify table exists in current database schema to prevent SQL injection
    const [tables] = await db.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
      [tableName]
    );

    if (tables.length === 0) {
      return res.status(404).json({ error: `Table '${tableName}' not found in database` });
    }

    // 2. Fetch column definitions
    const [columnsResult] = await db.query(
      "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION ASC",
      [tableName]
    );

    const columns = columnsResult.map((c) => ({
      name: c.COLUMN_NAME,
      type: c.DATA_TYPE,
      isPrimary: c.COLUMN_KEY === "PRI",
    }));

    // 3. Count total records
    const [[countResult]] = await db.query(`SELECT COUNT(*) AS total FROM \`${tableName}\``);
    const totalRows = Number(countResult.total) || 0;

    // 4. Fetch table rows
    const [rows] = await db.query(
      `SELECT * FROM \`${tableName}\` LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // Sanitize sensitive password fields for display
    const sanitizedRows = rows.map((row) => {
      const sanitized = { ...row };
      if (sanitized.password) {
        sanitized.password = sanitized.password.startsWith("$2")
          ? "•••••••• [Bcrypt Hash]"
          : "••••••••";
      }
      return sanitized;
    });

    res.json({
      success: true,
      tableName,
      totalRows,
      columns,
      rows: sanitizedRows,
      limit,
      offset,
    });
  } catch (err) {
    console.error("Fetch table data error:", err);
    res.status(500).json({ error: "Failed to fetch table data", message: err.message });
  }
};

// ── DELETE SINGLE TABLE RECORD (DEVELOPER ROW DELETION) ──
exports.deleteTableRow = async (req, res) => {
  const { tableName, primaryKey, primaryKeyValue } = req.body;

  if (!tableName || !primaryKey || primaryKeyValue === undefined || primaryKeyValue === null) {
    return res.status(400).json({ error: "tableName, primaryKey, and primaryKeyValue are required" });
  }

  try {
    // 1. Verify table exists in schema to prevent SQL Injection
    const [tables] = await db.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
      [tableName]
    );
    if (tables.length === 0) {
      return res.status(404).json({ error: `Table '${tableName}' does not exist` });
    }

    // 2. Verify column exists in that table
    const [columns] = await db.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
      [tableName, primaryKey]
    );
    if (columns.length === 0) {
      return res.status(400).json({ error: `Column '${primaryKey}' does not exist in table '${tableName}'` });
    }

    // Safety check: do not allow deleting the last remaining admin
    if (tableName.toLowerCase() === "admins") {
      const [adminsCount] = await db.query("SELECT COUNT(*) as total FROM admins");
      if (adminsCount[0].total <= 1) {
        return res.status(400).json({ error: "Cannot delete the only remaining admin account." });
      }
    }

    // If deleting from customers, delete their related transactions first to satisfy FK constraint
    if (tableName.toLowerCase() === "customers") {
      const [custRows] = await db.query("SELECT lot_id FROM customers WHERE customer_id = ?", [primaryKeyValue]);
      await db.query("DELETE FROM transactions WHERE customer_id = ?", [primaryKeyValue]);

      if (custRows.length > 0 && custRows[0].lot_id) {
        const lotId = custRows[0].lot_id;
        const [otherCust] = await db.query("SELECT customer_id FROM customers WHERE lot_id = ? AND customer_id != ?", [lotId, primaryKeyValue]);
        if (otherCust.length === 0) {
          await db.query("UPDATE lots SET status = 'Available' WHERE lot_id = ?", [lotId]);
        }
      }
    }

    // If deleting from lots, delete transactions and customers on that lot first
    if (tableName.toLowerCase() === "lots") {
      await db.query("DELETE FROM transactions WHERE lot_id = ?", [primaryKeyValue]);
      await db.query("DELETE FROM customers WHERE lot_id = ?", [primaryKeyValue]);
    }

    // Execute delete
    const [result] = await db.query(
      `DELETE FROM \`${tableName}\` WHERE \`${primaryKey}\` = ?`,
      [primaryKeyValue]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Record not found or already deleted" });
    }

    addDeveloperLog(`Deleted record in table '${tableName}' where ${primaryKey} = ${primaryKeyValue}`, {
      type: "DATABASE",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });

    res.json({ success: true, message: `Record #${primaryKeyValue} successfully deleted from '${tableName}'` });
  } catch (err) {
    console.error("Delete table record error:", err);
    res.status(500).json({ error: "Failed to delete table record due to database constraints." });
  }
};

// ── PURGE DEMO SEED DATA ONLY (PRESERVES ALL REAL INQUIRIES & TRANSACTIONS) ──
exports.purgeTestData = async (req, res) => {
  try {
    // 1. Identify which lots are linked to generated demo transactions or customers
    const [demoLots] = await db.query(`
      SELECT DISTINCT lot_id FROM transactions WHERE is_demo = 1 OR notes LIKE 'Demo %' OR notes LIKE '%[DEMO]%'
      UNION
      SELECT DISTINCT lot_id FROM customers WHERE is_demo = 1
    `);

    // 2. Delete ONLY generated demo transactions (preserves all real customer transactions)
    const [delTxnRes] = await db.query(
      "DELETE FROM transactions WHERE is_demo = 1 OR notes LIKE 'Demo %' OR notes LIKE '%[DEMO]%'"
    );

    // 3. Delete ONLY generated demo customers (preserves all real buyers and inquiries)
    const [delCustRes] = await db.query(
      "DELETE FROM customers WHERE is_demo = 1"
    );

    // 4. For lots affected by demo data, check if there are remaining REAL transactions or customers.
    // If NO real records exist on that lot, reset status back to 'Available' and pending_since = NULL.
    let lotsResetCount = 0;
    for (const row of demoLots) {
      if (!row.lot_id) continue;
      const [realTxns] = await db.query(
        "SELECT transaction_id FROM transactions WHERE lot_id = ? LIMIT 1",
        [row.lot_id]
      );
      const [realCusts] = await db.query(
        "SELECT customer_id FROM customers WHERE lot_id = ? LIMIT 1",
        [row.lot_id]
      );

      if (realTxns.length === 0 && realCusts.length === 0) {
        await db.query(
          "UPDATE lots SET status = 'Available', pending_since = NULL WHERE lot_id = ?",
          [row.lot_id]
        );
        lotsResetCount++;
      }
    }

    addDeveloperLog(`Purged ${delTxnRes.affectedRows} demo transactions & ${delCustRes.affectedRows} demo customers. Reset ${lotsResetCount} demo lots to 'Available' (real customer data preserved).`, {
      type: "SECURITY",
      role: "Developer",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });

    res.json({
      success: true,
      message: `Purged ${delTxnRes.affectedRows} generated demo transactions & ${delCustRes.affectedRows} demo customers. All real inquiries and customer transactions are safely preserved!`,
      purgedTransactions: delTxnRes.affectedRows,
      purgedCustomers: delCustRes.affectedRows,
      lotsReset: lotsResetCount,
    });
  } catch (err) {
    console.error("Purge test data error:", err);
    res.status(500).json({ error: "Failed to purge test data", message: err.message });
  }
};

// ── GENERATE CAPSTONE DEMO SEED DATA ──
exports.generateDemoData = async (req, res) => {
  const count = Math.min(Math.max(Number(req.body.count) || 6, 1), 20);

  const sampleBuyers = [
    { name: "Maria Clara Santos", email: "maria.santos24@gmail.com", phone: "09171234567", city: "Iloilo City, Iloilo" },
    { name: "Juan Carlos Dela Cruz", email: "juan.delacruz@yahoo.com", phone: "09189876543", city: "Barotac Nuevo, Iloilo" },
    { name: "Ricardo Cardo Dalisay", email: "ricardo.dalisay@gmail.com", phone: "09205551234", city: "Mandurriao, Iloilo City" },
    { name: "Kristine Joy Ramos", email: "kj.ramos@outlook.com", phone: "09284449876", city: "Jaro, Iloilo City" },
    { name: "Angelo Gabriel Reyes", email: "angelo.reyes@gmail.com", phone: "09357771234", city: "Dumangas, Iloilo" },
    { name: "Beatriz Elena Mendoza", email: "bea.mendoza@gmail.com", phone: "09198884321", city: "La Paz, Iloilo City" },
    { name: "Carlos Antonio Gomez", email: "carlos.gomez@yahoo.com", phone: "09276665432", city: "Oton, Iloilo" },
    { name: "Patricia Anne Lim", email: "patricia.lim@gmail.com", phone: "09173339012", city: "Molo, Iloilo City" },
    { name: "Eduardo Ramon Villanueva", email: "ed.villanueva@gmail.com", phone: "09228887766", city: "Santa Barbara, Iloilo" },
    { name: "Theresa Mae Gonzaga", email: "theresa.gonzaga@gmail.com", phone: "09182223344", city: "Pavia, Iloilo" },
  ];

  const statusOptions = ["Sold", "Pending", "Cancelled", "Sold", "Pending", "Sold", "Cancelled"];

  try {
    // 1. Fetch available lots to reserve/purchase
    let [availableLots] = await db.query(
      "SELECT lot_id, lot_number, property_id, area_sqm, status FROM lots WHERE status = 'Available' ORDER BY lot_id ASC LIMIT ?",
      [count]
    );

    if (availableLots.length === 0) {
      // Fallback: take any lots
      const [allLots] = await db.query("SELECT lot_id, lot_number, property_id, area_sqm, status FROM lots LIMIT ?", [count]);
      availableLots = allLots;
    }

    if (availableLots.length === 0) {
      return res.status(400).json({ error: "No lots found in database to generate demo data for." });
    }

    const createdRecords = [];
    const now = new Date();

    // Fetch only active employees to distribute as demo agents (does NOT auto-create employees)
    const [empRows] = await db.query("SELECT employee_id FROM employees WHERE status = 'active'");
    const agentPool = empRows.length > 0 ? [...empRows.map((e) => e.employee_id), null] : [null];

    for (let i = 0; i < Math.min(count, availableLots.length); i++) {
      const lot = availableLots[i];
      const buyer = sampleBuyers[i % sampleBuyers.length];
      const targetStatus = statusOptions[i % statusOptions.length];
      // Golden Dragon standard payment types: Cash & Installment for Sold/Cancelled; No Downpayment for Pending reservations
      const paymentType = targetStatus === "Pending" ? "No Downpayment" : (i % 2 === 0 ? "Cash" : "Installment");
      const demoEmployeeId = agentPool[i % agentPool.length];

      // Spread dates across recent days (e.g. 1 to 25 days ago) for realistic charts
      const daysAgo = Math.floor(Math.random() * 25) + 1;
      const transDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      const isoTransDate = transDate.toISOString().slice(0, 19).replace("T", " ");

      // Unique email suffix if repeated
      const buyerEmail = i >= sampleBuyers.length
        ? `${buyer.email.split("@")[0]}_${i + 1}@${buyer.email.split("@")[1]}`
        : buyer.email;

      // 1. Insert into customers (flagged as is_demo = 1)
      const custStatus = targetStatus === "Sold" ? "Sold" : (targetStatus === "Cancelled" ? "Cancelled" : "Pending");
      const [custResult] = await db.query(
        `INSERT INTO customers (lot_id, full_name, contact_number, email, address, employee_id, customer_status, is_demo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [lot.lot_id, buyer.name, buyer.phone, buyerEmail, buyer.city, demoEmployeeId, custStatus, isoTransDate, isoTransDate]
      );
      const customerId = custResult.insertId;

      // 2. Insert into transactions (flagged as is_demo = 1)
      const noteText = targetStatus === "Sold"
        ? `Demo Purchase: Full reservation & payment recorded for Lot ${lot.lot_number || lot.lot_id} via ${paymentType}.`
        : targetStatus === "Cancelled"
          ? `Demo Cancellation: Client requested cancellation of inquiry for Lot ${lot.lot_number || lot.lot_id}.`
          : `Demo Inquiry: Active lot reservation pending client verification.`;

      await db.query(
        `INSERT INTO transactions (lot_id, customer_id, employee_id, transaction_date, payment_type, notes, is_demo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [lot.lot_id, customerId, demoEmployeeId, isoTransDate, paymentType, noteText, isoTransDate, isoTransDate]
      );

      // 3. Update lot status (if Cancelled, lot remains Available for new buyers)
      const lotNewStatus = targetStatus === "Cancelled" ? "Available" : targetStatus;
      await db.query(
        "UPDATE lots SET status = ?, pending_since = ? WHERE lot_id = ?",
        [lotNewStatus, targetStatus === "Pending" ? isoTransDate : null, lot.lot_id]
      );

      createdRecords.push({
        customerId,
        lotId: lot.lot_id,
        lotNumber: lot.lot_number,
        buyerName: buyer.name,
        paymentType,
        status: targetStatus,
        date: isoTransDate,
      });
    }

    addDeveloperLog(`Generated ${createdRecords.length} Capstone demo inquiries and transactions.`, {
      type: "DATABASE",
      role: "Developer",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });

    res.json({
      success: true,
      count: createdRecords.length,
      message: `Successfully generated ${createdRecords.length} realistic demo customer transactions!`,
      records: createdRecords,
    });
  } catch (err) {
    console.error("Generate demo data error:", err);
    res.status(500).json({ error: "Failed to generate demo data", message: err.message });
  }
};

// ── GET DEMO STAFF STATUS ──
exports.getDemoStaffStatus = async (req, res) => {
  try {
    const results = [];
    for (const staff of DEMO_STAFF_CONFIG) {
      const [rows] = await db.query(
        "SELECT employee_id, status FROM employees WHERE LOWER(email) = ?",
        [staff.email.toLowerCase()]
      );
      const isProvisioned = rows.length > 0;
      const isActive = isProvisioned && String(rows[0].status || "").toLowerCase() === "active";
      results.push({
        name: `${staff.first_name} ${staff.last_name}`,
        email: staff.email,
        password: staff.rawPassword,
        role: "Staff / Employee",
        employee_id: isProvisioned ? rows[0].employee_id : null,
        status: isProvisioned ? rows[0].status : "unprovisioned",
        isActive,
      });
    }
    res.json({ success: true, staff: results });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch demo staff status", message: err.message });
  }
};

// ── TOGGLE INDIVIDUAL DEMO EMPLOYEE (ACTIVATE / DEACTIVATE) ──
exports.toggleDemoEmployee = async (req, res) => {
  try {
    const { email, action } = req.body;
    const target = DEMO_STAFF_CONFIG.find((s) => s.email.toLowerCase() === String(email || "").toLowerCase());
    if (!target) {
      return res.status(400).json({ error: "Invalid demo staff account." });
    }

    const [existing] = await db.query(
      "SELECT employee_id, status FROM employees WHERE LOWER(email) = ?",
      [target.email.toLowerCase()]
    );

    if (action === "deactivate") {
      if (existing.length > 0) {
        await db.query("UPDATE employees SET status = 'inactive' WHERE employee_id = ?", [existing[0].employee_id]);
      }
      addDeveloperLog(`Deactivated demo staff account: ${target.first_name} ${target.last_name} (${target.email}).`, {
        type: "ADMIN",
        role: "Developer",
        device: parseDevice(req.headers["user-agent"]),
        ip: getClientIp(req),
      });
      return res.json({ success: true, message: `Deactivated ${target.first_name} ${target.last_name} successfully!` });
    } else {
      // Activate or Provision
      const hashedPassword = await bcrypt.hash(target.rawPassword, 10);
      if (existing.length > 0) {
        await db.query(
          "UPDATE employees SET password = ?, status = 'active', password_reset_required = 0 WHERE employee_id = ?",
          [hashedPassword, existing[0].employee_id]
        );
      } else {
        await db.query(
          "INSERT INTO employees (first_name, last_name, email, password, status, password_reset_required) VALUES (?, ?, ?, ?, 'active', 0)",
          [target.first_name, target.last_name, target.email.toLowerCase(), hashedPassword]
        );
      }
      addDeveloperLog(`Activated demo staff account: ${target.first_name} ${target.last_name} (${target.email}).`, {
        type: "ADMIN",
        role: "Developer",
        device: parseDevice(req.headers["user-agent"]),
        ip: getClientIp(req),
      });
      return res.json({ success: true, message: `Activated ${target.first_name} ${target.last_name} successfully!` });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to toggle demo employee", message: err.message });
  }
};

// ── ACTIVATE ALL DEMO EMPLOYEES ──
exports.generateDemoEmployees = async (req, res) => {
  try {
    const results = [];
    for (const staff of DEMO_STAFF_CONFIG) {
      const [existing] = await db.query("SELECT employee_id FROM employees WHERE LOWER(email) = ?", [staff.email.toLowerCase()]);
      const hashedPassword = await bcrypt.hash(staff.rawPassword, 10);

      let empId;
      if (existing.length > 0) {
        empId = existing[0].employee_id;
        await db.query("UPDATE employees SET password = ?, status = 'active', password_reset_required = 0 WHERE employee_id = ?", [
          hashedPassword,
          empId,
        ]);
      } else {
        const [insertRes] = await db.query(
          "INSERT INTO employees (first_name, last_name, email, password, status, password_reset_required) VALUES (?, ?, ?, ?, 'active', 0)",
          [staff.first_name, staff.last_name, staff.email.toLowerCase(), hashedPassword]
        );
        empId = insertRes.insertId;
      }

      results.push({
        employee_id: empId,
        name: `${staff.first_name} ${staff.last_name}`,
        email: staff.email,
        password: staff.rawPassword,
        role: "Staff / Employee",
        isActive: true,
        status: "active",
      });
    }

    addDeveloperLog(`Activated all ${results.length} demo employee testing accounts.`, {
      type: "ADMIN",
      role: "Developer",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });

    res.json({
      success: true,
      message: `Successfully activated all ${results.length} demo staff accounts!`,
      employees: results,
    });
  } catch (err) {
    console.error("Generate demo employees error:", err);
    res.status(500).json({ error: "Failed to generate demo employees", message: err.message });
  }
};

// ── DEACTIVATE ALL DEMO EMPLOYEES ──
exports.deactivateAllDemoEmployees = async (req, res) => {
  try {
    const demoEmails = DEMO_STAFF_CONFIG.map((s) => s.email.toLowerCase());
    await db.query("UPDATE employees SET status = 'inactive' WHERE LOWER(email) IN (?, ?, ?)", demoEmails);

    addDeveloperLog("Deactivated all demo employee accounts.", {
      type: "ADMIN",
      role: "Developer",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });

    res.json({ success: true, message: "All demo staff accounts have been deactivated." });
  } catch (err) {
    res.status(500).json({ error: "Failed to deactivate demo employees", message: err.message });
  }
};
