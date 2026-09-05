// routes/developerRoutes.js
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const db = require("../../config/database_connection");
const { generateBackupSql } = require("../services/dbBackupService");
const { addDeveloperLog, logAuthEvent, parseDevice, getClientIp } = require("../services/loggerService");
const configPath = path.join(__dirname, "../../config/system_state.json");

// ── OWASP TOP 10 HARDENING: RATE LIMITER FOR PIN VERIFICATION ──
const devPinRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 attempts per window per IP
  message: { error: "Too many authentication attempts. Please wait 15 minutes before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
});

let runtimeCustomPin = null;

// Helper to get active developer PIN (Supports Console UI changes + Render Env Variables)
function getActiveDeveloperPin() {
  // 1. If changed dynamically in the Developer Console UI at runtime
  if (runtimeCustomPin) {
    return runtimeCustomPin;
  }
  try {
    if (fs.existsSync(configPath)) {
      const state = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (state.runtimeDeveloperPin) return state.runtimeDeveloperPin.toString().trim();
    }
  } catch (err) {}

  // 2. Master Environment Variable from Render Dashboard
  const envPin = (process.env.DEVELOPER_PIN || process.env.DEV_PIN || "").toString().trim();
  if (envPin) {
    return envPin;
  }

  // 3. Fallback from system_state.json
  try {
    if (fs.existsSync(configPath)) {
      const state = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (state.developerPin) return state.developerPin.toString().trim();
    }
  } catch (err) {}

  return "1234";
}

// Middleware to verify developer session (OWASP A01: Broken Access Control)
function requireDeveloper(req, res, next) {
  const activePin = getActiveDeveloperPin();
  // Accept securely via header or established session (disallow query param to prevent URL leak)
  const devKey = req.headers["x-developer-pin"] || req.body?.key;

  if (devKey && devKey.toString().trim() === activePin) {
    if (req.session) {
      req.session.isDeveloper = true;
    }
    return next();
  }

  if (req.session && req.session.isDeveloper) {
    return next();
  }

  return res.status(403).json({ error: "Access Denied: Developer authentication required" });
}

// Helper to read system_state.json
function readSystemStateFile() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
  } catch (err) {}
  return { maintenanceMode: false, developerPin: "1234", logs: [], dismissedMessengerPsids: [] };
}

// Helper to write to system_state.json
function updateSystemStateFile(updatedFields) {
  try {
    let currentState = readSystemStateFile();
    const mergedState = { ...currentState, ...updatedFields };
    fs.writeFileSync(configPath, JSON.stringify(mergedState, null, 2), "utf8");
    return mergedState;
  } catch (e) {
    console.error("Failed to update system_state.json:", e);
    return null;
  }
}

// ── VERIFY DEVELOPER PIN (WITH BRUTE-FORCE RATE LIMITING) ──
router.post("/verify-pin", devPinRateLimiter, (req, res) => {
  const { pin } = req.body;
  const activePin = getActiveDeveloperPin();

  if (!pin) {
    if (req.session) req.session.isDeveloper = false;
    return res.status(400).json({ error: "PIN is required" });
  }

  if (pin.toString().trim() === activePin) {
    if (req.session) req.session.isDeveloper = true;
    logAuthEvent(req, "Developer console authenticated", {
      type: "SECURITY",
      user: "Developer (Root)",
      role: "Developer",
    });
    return res.json({ success: true, message: "Developer authentication successful" });
  }

  if (req.session) {
    req.session.isDeveloper = false;
  }
  // OWASP A09: Mask failed PIN input to prevent sensitive data exposure in logs
  logAuthEvent(req, "Failed Developer PIN authentication attempt", {
    type: "SECURITY",
    user: "Unknown",
    role: "Developer",
  });
  return res.status(401).json({ error: "Invalid Developer PIN" });
});

// ── CHANGE DEVELOPER PIN ──
router.post("/change-pin", requireDeveloper, (req, res) => {
  const { currentPin, newPin, confirmNewPin } = req.body;
  const activePin = getActiveDeveloperPin();

  if (!currentPin || !newPin || !confirmNewPin) {
    return res.status(400).json({ error: "All fields are required" });
  }

  if (currentPin.toString().trim() !== activePin) {
    return res.status(400).json({ error: "Current PIN is incorrect" });
  }

  const cleanNewPin = newPin.toString().trim();
  const cleanConfirmPin = confirmNewPin.toString().trim();

  if (cleanNewPin.length < 4) {
    return res.status(400).json({ error: "New PIN must be at least 4 digits or characters long" });
  }

  if (cleanNewPin !== cleanConfirmPin) {
    return res.status(400).json({ error: "New PIN and confirmation PIN do not match" });
  }

  runtimeCustomPin = cleanNewPin;
  const updatedState = updateSystemStateFile({ developerPin: cleanNewPin, runtimeDeveloperPin: cleanNewPin });
  if (updatedState) {
    logAuthEvent(req, "Developer PIN was successfully changed", {
      type: "SECURITY",
      user: "Developer (Root)",
      role: "Developer",
    });

    try {
      sendMessengerAlert("Developer PIN Updated", "The developer security master PIN was updated successfully.", {
        category: "systemChanges",
        user: "Developer Console",
        ip: getClientIp(req),
      }).catch(() => {});
    } catch (_) {}

    return res.json({ 
      success: true, 
      message: "Developer Security PIN updated successfully!", 
      newPin: cleanNewPin 
    });
  }

  res.status(500).json({ error: "Failed to update Developer PIN" });
});

// ── PUBLIC MAINTENANCE STATUS FOR REDIRECTS ──
router.get("/maintenance-status", (req, res) => {
  try {
    let state = { maintenanceMode: false };
    if (fs.existsSync(configPath)) {
      state = JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
    res.json({ maintenanceMode: !!state.maintenanceMode });
  } catch (e) {
    res.json({ maintenanceMode: false });
  }
});

// ── GET SYSTEM STATE & LOGS ──
router.get("/system-state", requireDeveloper, (req, res) => {
  try {
    let state = { maintenanceMode: false, logs: [] };
    if (fs.existsSync(configPath)) {
      state = JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
    res.json({
      maintenanceMode: !!state.maintenanceMode,
      logs: state.logs || [],
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to read system state" });
  }
});

// ── TOGGLE MAINTENANCE MODE ──
router.post("/toggle-maintenance", requireDeveloper, (req, res) => {
  const { maintenanceMode } = req.body;

  if (typeof maintenanceMode !== "boolean") {
    return res.status(400).json({ error: "maintenanceMode must be a boolean" });
  }

  const newState = updateSystemStateFile({ maintenanceMode });
  if (newState) {
    addDeveloperLog(`System maintenance mode set to: ${maintenanceMode ? "ENABLED" : "DISABLED"}`, {
      type: "MAINTENANCE",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });

    try {
      sendMessengerAlert(
        `Maintenance Mode: ${maintenanceMode ? "ENABLED" : "DISABLED"}`,
        `The platform was set to ${maintenanceMode ? "Maintenance Mode (Under Construction)" : "Live Operations Mode"}.`,
        {
          category: "systemChanges",
          user: "Developer Console",
          ip: getClientIp(req),
        }
      ).catch(() => {});
    } catch (_) {}

    return res.json({ success: true, maintenanceMode: newState.maintenanceMode });
  }

  res.status(500).json({ error: "Failed to toggle maintenance mode" });
});

// ── BACKUP DATABASE ──
router.get("/backup-db", requireDeveloper, async (req, res) => {
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
});

// ── LIVE DATABASE TABLE & STORAGE INSPECTOR ──
router.get("/db-inspector", requireDeveloper, async (req, res) => {
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
});

// ── GET TABLE DATA ROWS (TABLE DATA EXPLORER) ──
router.get("/table-data/:tableName", requireDeveloper, async (req, res) => {
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
});

// ── DELETE SINGLE TABLE RECORD (DEVELOPER ROW DELETION) ──
router.delete("/table-row", requireDeveloper, async (req, res) => {
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
});

// ── PURGE DEMO SEED DATA ONLY (PRESERVES ALL REAL INQUIRIES & TRANSACTIONS) ──
router.post("/purge-test-data", requireDeveloper, async (req, res) => {
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
});

// ── GENERATE CAPSTONE DEMO SEED DATA ──
router.post("/generate-demo-data", requireDeveloper, async (req, res) => {
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
});

// ── DEMO STAFF CONFIGURATION CONSTANT ──
const DEMO_STAFF_CONFIG = [
  { first_name: "Sarah Mae", last_name: "Santos", email: "sarah.santos@goldendragon.com", rawPassword: "Password123!" },
  { first_name: "Mark Anthony", last_name: "Reyes", email: "mark.reyes@goldendragon.com", rawPassword: "Password123!" },
  { first_name: "Eduardo", last_name: "Ramos", email: "eduardo.ramos@goldendragon.com", rawPassword: "Password123!" },
];

// ── GET DEMO STAFF STATUS ──
router.get("/demo-staff-status", requireDeveloper, async (req, res) => {
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
});

// ── TOGGLE INDIVIDUAL DEMO EMPLOYEE (ACTIVATE / DEACTIVATE) ──
router.post("/toggle-demo-employee", requireDeveloper, async (req, res) => {
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
});

// ── ACTIVATE ALL DEMO EMPLOYEES ──
router.post("/generate-demo-employees", requireDeveloper, async (req, res) => {
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
});

// ── DEACTIVATE ALL DEMO EMPLOYEES ──
router.post("/deactivate-all-demo-employees", requireDeveloper, async (req, res) => {
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
});

// ── API ROUTES & ENDPOINT HEALTH MONITOR ──
router.get("/api-health", requireDeveloper, async (req, res) => {
  const routesToCheck = [
    {
      name: "Subdivision Properties API",
      path: "/api/properties",
      method: "GET",
      domain: "Public / Map",
      description: "Fetches active subdivision properties and estates",
      check: async () => {
        const [rows] = await db.query("SELECT property_id, property_name FROM properties LIMIT 1");
        return { count: rows.length };
      },
    },
    {
      name: "Lot Inventory & Coordinates",
      path: "/api/lots",
      method: "GET",
      domain: "Public / Map",
      description: "Retrieves subdivision lots and 2D map polygon coordinates",
      check: async () => {
        const [rows] = await db.query("SELECT lot_id, lot_number FROM lots LIMIT 1");
        return { count: rows.length };
      },
    },
    {
      name: "Transactions & Audit History",
      path: "/api/transactions",
      method: "GET",
      domain: "Transactions",
      description: "Client lot purchases, reservations, and payment logs",
      check: async () => {
        const [rows] = await db.query("SELECT transaction_id FROM transactions LIMIT 1");
        return { count: rows.length };
      },
    },
    {
      name: "Customer Directory API",
      path: "/api/customers",
      method: "GET",
      domain: "Transactions",
      description: "Buyer registry, contacts, and email records",
      check: async () => {
        const [rows] = await db.query("SELECT customer_id FROM customers LIMIT 1");
        return { count: rows.length };
      },
    },
    {
      name: "Admin Dashboard KPI Engine",
      path: "/api/lots/dashboard-stats",
      method: "GET",
      domain: "Analytics",
      description: "Live lot summary totals and client aggregations",
      check: async () => {
        const [rows] = await db.query("SELECT COUNT(*) as cnt FROM lots");
        return { totalLots: rows[0].cnt };
      },
    },
    {
      name: "Monthly Recap Sales Trends",
      path: "/api/lots/monthly-sales",
      method: "GET",
      domain: "Analytics",
      description: "Aggregates 12-month sales data for area charts",
      check: async () => {
        const [rows] = await db.query(
          "SELECT COUNT(*) as cnt FROM transactions WHERE YEAR(transaction_date) = YEAR(CURDATE())"
        );
        return { count: rows[0].cnt };
      },
    },
    {
      name: "Time-Based Subdivision Sales",
      path: "/api/lots/time-based-sales",
      method: "GET",
      domain: "Analytics",
      description: "Property-by-property sales filter (today, week, month, year)",
      check: async () => {
        const [rows] = await db.query("SELECT property_id FROM properties LIMIT 1");
        return { count: rows.length };
      },
    },
    {
      name: "Developer Security & System State",
      path: "/api/developer/system-state",
      method: "GET",
      domain: "Developer Core",
      description: "Maintenance mode state and audit logs",
      check: async () => {
        return { state: "operational" };
      },
    },
    {
      name: "UptimeRobot / Render Keep-Alive Ping",
      path: "/api/health",
      method: "GET",
      domain: "Infrastructure",
      description: "Public health ping used by UptimeRobot to keep Render backend awake 24/7",
      check: async () => {
        return { status: "ok" };
      },
    },
    {
      name: "Aiven Cloud MySQL Engine",
      path: "TCP :3306",
      method: "PING",
      domain: "Infrastructure",
      description: "Direct MySQL connection pool & socket handshake",
      check: async () => {
        const [res] = await db.query("SELECT 1 as ping");
        return { ping: res[0].ping };
      },
    },
  ];

  const results = [];
  let totalLatency = 0;

  for (const item of routesToCheck) {
    const start = performance.now();
    try {
      await item.check();
      const latencyMs = Math.max(1, Math.round(performance.now() - start));
      totalLatency += latencyMs;

      results.push({
        name: item.name,
        path: item.path,
        method: item.method,
        domain: item.domain,
        description: item.description,
        status: 200,
        statusText: "OK",
        latencyMs,
        isHealthy: true,
      });
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      results.push({
        name: item.name,
        path: item.path,
        method: item.method,
        domain: item.domain,
        description: item.description,
        status: 500,
        statusText: "ERR",
        latencyMs,
        isHealthy: false,
        error: err.message,
      });
    }
  }

  const healthyCount = results.filter((r) => r.isHealthy).length;
  const avgLatencyMs = Math.round(totalLatency / results.length) || 1;

  res.json({
    success: true,
    totalEndpoints: results.length,
    healthyCount,
    allHealthy: healthyCount === results.length,
    avgLatencyMs,
    timestamp: new Date().toISOString(),
    endpoints: results,
  });
});

// ── ENVIRONMENT VARIABLES (.ENV) HEALTH INSPECTOR ──
router.get("/env-health", requireDeveloper, (req, res) => {
  const envSpecs = [
    {
      key: "DB_HOST",
      category: "Database",
      required: true,
      description: "MySQL host address (Localhost or Aiven Cloud URL)",
      mask: false,
    },
    {
      key: "DB_USER",
      category: "Database",
      required: true,
      description: "Database authentication username",
      mask: false,
    },
    {
      key: "DB_PASSWORD",
      category: "Database",
      required: false,
      description: "Database authentication password",
      mask: true,
    },
    {
      key: "DB_NAME",
      category: "Database",
      required: true,
      description: "Target database schema name",
      mask: false,
    },
    {
      key: "PORT",
      category: "Server",
      required: false,
      description: "HTTP server listener port (e.g. 5000 or Render PORT)",
      mask: false,
      default: "5000",
    },
    {
      key: "NODE_ENV",
      category: "Server",
      required: false,
      description: "Runtime environment mode (development / production)",
      mask: false,
      default: "development",
    },
    {
      key: "SESSION_SECRET",
      category: "Security",
      required: true,
      description: "Cookie and express-session encryption key",
      mask: true,
    },
    {
      key: "JWT_SECRET",
      category: "Security",
      required: true,
      description: "Cryptographic secret for signing Admin/Employee JWT tokens",
      mask: true,
    },
    {
      key: "DEVELOPER_PIN",
      category: "Security",
      required: false,
      description: "Developer Panel root master security PIN fallback",
      mask: true,
    },
    {
      key: "EMAIL_USER",
      category: "Notifications",
      required: false,
      description: "Primary outgoing sender email address for notifications",
      mask: false,
    },
    {
      key: "BREVO_API_KEY",
      category: "Notifications",
      required: false,
      description: "Brevo Transactional Email HTTPS API key",
      mask: true,
    },
    {
      key: "FB_PAGE_ACCESS_TOKEN",
      category: "Notifications",
      required: false,
      description: "Meta / Facebook Page Access Token for Messenger developer alerts",
      mask: true,
    },
    {
      key: "FB_RECIPIENT_PSID",
      category: "Notifications",
      required: false,
      description: "Developer personal Facebook Messenger User ID (PSID)",
      mask: true,
    },
  ];

  const maskValue = (val) => {
    if (!val) return "";
    if (val.length <= 8) return "••••••••";
    return `${val.slice(0, 4)}••••••••${val.slice(-4)}`;
  };

  const variables = envSpecs.map((spec) => {
    const rawVal = process.env[spec.key] || (spec.default ? spec.default : "");
    const isSet = process.env[spec.key] !== undefined && process.env[spec.key] !== "";
    const isDefault = !process.env[spec.key] && !!spec.default;

    let displayVal = "";
    if (isSet || isDefault) {
      displayVal = spec.mask ? maskValue(rawVal) : rawVal;
    }

    let status = "CONFIGURED";
    if (!isSet && spec.required) status = "MISSING_REQUIRED";
    else if (!isSet && isDefault) status = "USING_DEFAULT";
    else if (!isSet) status = "OPTIONAL_NOT_SET";

    return {
      key: spec.key,
      category: spec.category,
      required: spec.required,
      description: spec.description,
      isSet: isSet || isDefault,
      status,
      displayValue: displayVal,
    };
  });

  const totalRequired = envSpecs.filter((s) => s.required).length;
  const configuredRequired = variables.filter((v) => v.required && v.isSet).length;
  const allRequiredSet = configuredRequired === totalRequired;

  res.json({
    success: true,
    allRequiredSet,
    configuredCount: variables.filter((v) => v.isSet).length,
    totalCount: variables.length,
    totalRequired,
    configuredRequired,
    variables,
  });
});

// ── EMERGENCY GLOBAL KILL SWITCH / FORCE LOGOUT ALL ──
router.post("/global-kill-switch", requireDeveloper, (req, res) => {
  try {
    const timestamp = new Date().toISOString();
    updateSystemStateFile({ authRevocationTimestamp: timestamp });

    addDeveloperLog(`🚨 EMERGENCY GLOBAL KILL SWITCH: Force-logged out all active sessions and invalidated all issued JWT tokens.`, {
      type: "SECURITY",
      role: "Developer",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });

    res.json({
      success: true,
      timestamp,
      message: "Emergency Global Kill Switch triggered successfully! All active JWT tokens and sessions have been invalidated immediately.",
    });
  } catch (err) {
    console.error("Global kill switch error:", err);
    res.status(500).json({ error: "Failed to trigger global kill switch", message: err.message });
  }
});

// ── GET GLOBAL KILL SWITCH STATUS ──
router.get("/global-kill-switch-status", requireDeveloper, (req, res) => {
  try {
    let authRevocationTimestamp = null;
    if (fs.existsSync(configPath)) {
      const state = JSON.parse(fs.readFileSync(configPath, "utf8"));
      authRevocationTimestamp = state.authRevocationTimestamp || null;
    }
    res.json({ success: true, authRevocationTimestamp });
  } catch (err) {
    res.status(500).json({ error: "Failed to get kill switch status" });
  }
});

// ── MAP & LOT COORDINATES DIAGNOSTICS ──
router.get("/map-diagnostics", requireDeveloper, async (req, res) => {
  try {
    // 1. Fetch properties
    const [properties] = await db.query(
      "SELECT property_id, property_name, location, total_lots FROM properties ORDER BY property_name ASC"
    );

    // 2. Fetch all lots with their property names and coordinates
    const [lots] = await db.query(`
      SELECT 
        l.lot_id, 
        l.property_id, 
        p.property_name,
        l.lot_number, 
        l.area_sqm, 
        l.status, 
        l.coordinates 
      FROM lots l
      LEFT JOIN properties p ON l.property_id = p.property_id
      ORDER BY p.property_name ASC, CAST(l.lot_number AS UNSIGNED) ASC, l.lot_number ASC
    `);

    let totalLots = lots.length;
    let mappedCount = 0;
    let unmappedCount = 0;
    let corruptedCount = 0;
    let pointOnlyCount = 0;
    let polygonCount = 0;

    const propertyMap = {};
    for (const prop of properties) {
      propertyMap[prop.property_id] = {
        propertyId: prop.property_id,
        propertyName: prop.property_name,
        location: prop.location,
        totalLots: 0,
        mappedLots: 0,
        unmappedLots: 0,
        corruptedLots: 0,
        coveragePct: 0,
      };
    }

    const flaggedLots = [];

    for (const lot of lots) {
      const propId = lot.property_id;
      if (!propertyMap[propId]) {
        propertyMap[propId] = {
          propertyId: propId,
          propertyName: lot.property_name || `Property #${propId}`,
          location: "N/A",
          totalLots: 0,
          mappedLots: 0,
          unmappedLots: 0,
          corruptedLots: 0,
          coveragePct: 0,
        };
      }

      propertyMap[propId].totalLots += 1;

      // Inspect coordinates structure
      if (!lot.coordinates) {
        unmappedCount += 1;
        propertyMap[propId].unmappedLots += 1;
        flaggedLots.push({
          lotId: lot.lot_id,
          propertyId: lot.property_id,
          propertyName: lot.property_name || "Unknown",
          lotNumber: lot.lot_number,
          status: lot.status,
          areaSqm: lot.area_sqm,
          issue: "Missing Coordinates",
          issueType: "UNMAPPED",
          severity: "warning",
          description: "No polygon or pin saved. This lot is invisible on the interactive map.",
        });
        continue;
      }

      let parsed = null;
      try {
        parsed = typeof lot.coordinates === "string" ? JSON.parse(lot.coordinates) : lot.coordinates;
      } catch (err) {
        corruptedCount += 1;
        propertyMap[propId].corruptedLots += 1;
        flaggedLots.push({
          lotId: lot.lot_id,
          propertyId: lot.property_id,
          propertyName: lot.property_name || "Unknown",
          lotNumber: lot.lot_number,
          status: lot.status,
          areaSqm: lot.area_sqm,
          issue: "Corrupted JSON",
          issueType: "CORRUPTED",
          severity: "danger",
          description: "Invalid JSON format in coordinates column. Needs repair.",
        });
        continue;
      }

      if (!Array.isArray(parsed) || parsed.length === 0) {
        unmappedCount += 1;
        propertyMap[propId].unmappedLots += 1;
        flaggedLots.push({
          lotId: lot.lot_id,
          propertyId: lot.property_id,
          propertyName: lot.property_name || "Unknown",
          lotNumber: lot.lot_number,
          status: lot.status,
          areaSqm: lot.area_sqm,
          issue: "Empty Geometry Array",
          issueType: "UNMAPPED",
          severity: "warning",
          description: "Empty array saved in coordinates.",
        });
        continue;
      }

      // Check if Point [lat, lng] (length == 2 of numbers)
      if (parsed.length === 2 && typeof parsed[0] === "number" && typeof parsed[1] === "number") {
        pointOnlyCount += 1;
        mappedCount += 1;
        propertyMap[propId].mappedLots += 1;
      } 
      // Check if Polygon [[lat, lng], [lat, lng], ...]
      else if (parsed.length >= 3 && Array.isArray(parsed[0])) {
        // Validate each point
        const hasInvalidPoints = parsed.some(
          (pt) => !Array.isArray(pt) || pt.length < 2 || isNaN(Number(pt[0])) || isNaN(Number(pt[1]))
        );
        if (hasInvalidPoints) {
          corruptedCount += 1;
          propertyMap[propId].corruptedLots += 1;
          flaggedLots.push({
            lotId: lot.lot_id,
            propertyId: lot.property_id,
            propertyName: lot.property_name || "Unknown",
            lotNumber: lot.lot_number,
            status: lot.status,
            areaSqm: lot.area_sqm,
            issue: "Invalid Vertex Point",
            issueType: "CORRUPTED",
            severity: "danger",
            description: "Polygon array contains non-numeric latitude/longitude vertices.",
          });
        } else {
          polygonCount += 1;
          mappedCount += 1;
          propertyMap[propId].mappedLots += 1;
        }
      } else {
        corruptedCount += 1;
        propertyMap[propId].corruptedLots += 1;
        flaggedLots.push({
          lotId: lot.lot_id,
          propertyId: lot.property_id,
          propertyName: lot.property_name || "Unknown",
          lotNumber: lot.lot_number,
          status: lot.status,
          areaSqm: lot.area_sqm,
          issue: "Incomplete Polygon",
          issueType: "CORRUPTED",
          severity: "warning",
          description: "Polygon has fewer than 3 vertices.",
        });
      }
    }

    // Calculate percentage per property
    const propertyBreakdown = Object.values(propertyMap).map((p) => ({
      ...p,
      coveragePct: p.totalLots > 0 ? Math.round((p.mappedLots / p.totalLots) * 100) : 0,
    }));

    const overallCoveragePct = totalLots > 0 ? Math.round((mappedCount / totalLots) * 100) : 0;

    res.json({
      success: true,
      totalLots,
      mappedCount,
      unmappedCount,
      corruptedCount,
      polygonCount,
      pointOnlyCount,
      overallCoveragePct,
      propertyBreakdown,
      flaggedLots,
      scannedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Map diagnostics error:", err);
    res.status(500).json({ error: "Failed to run map diagnostics", message: err.message });
  }
});

// ── CLEAR CONSOLE LOGS ──
router.post("/clear-logs", requireDeveloper, (req, res) => {
  const { type } = req.body; // "AUTH", "SYSTEM", or undefined (all)
  
  let currentState = { maintenanceMode: false, developerPin: "1234", logs: [] };
  if (fs.existsSync(configPath)) {
    try {
      currentState = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (err) {}
  }
  
  let filteredLogs = [];
  if (type === "AUTH") {
    filteredLogs = (currentState.logs || []).filter(
      (log) => (log.type || "").toUpperCase() !== "AUTH"
    );
  } else if (type === "SECURITY") {
    filteredLogs = (currentState.logs || []).filter(
      (log) => !["SECURITY", "ERROR", "CRASH"].includes((log.type || "").toUpperCase()) && !(log.event || "").includes("KILL SWITCH") && !(log.event || "").includes("System Error")
    );
  } else if (type === "DATABASE") {
    filteredLogs = (currentState.logs || []).filter(
      (log) => (log.type || "").toUpperCase() !== "DATABASE" && (log.type || "").toUpperCase() !== "BACKUP" && !(log.event || "").includes("Capstone") && !(log.event || "").includes("Purged")
    );
  } else if (type === "SYSTEM" || type === "MAINTENANCE") {
    filteredLogs = (currentState.logs || []).filter(
      (log) => !["SYSTEM", "MAINTENANCE", "ADMIN", "EMAIL"].includes((log.type || "").toUpperCase())
    );
  } else {
    filteredLogs = [];
  }

  const updatedState = updateSystemStateFile({ logs: filteredLogs });
  if (updatedState) {
    return res.json({ success: true, message: "Logs cleared successfully", logs: filteredLogs });
  }
  res.status(500).json({ error: "Failed to clear logs" });
});

// ── GET ADMIN ACCOUNTS LIST ──
router.get("/admins", requireDeveloper, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT admin_id, full_name, email FROM admins ORDER BY admin_id ASC");
    res.json({ success: true, admins: rows });
  } catch (err) {
    console.error("Fetch admins error:", err);
    res.status(500).json({ error: "Failed to fetch admin accounts" });
  }
});

// ── CREATE NEW ADMIN ACCOUNT ──
router.post("/create-admin", requireDeveloper, async (req, res) => {
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
});

// ── RESET ADMIN PASSWORD (DEVELOPER OVERRIDE) ──
router.post("/reset-admin-password", requireDeveloper, async (req, res) => {
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
});

// ── UPDATE ADMIN PROFILE (FULL NAME & EMAIL) ──
router.put("/update-admin", requireDeveloper, async (req, res) => {
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
});

// ── DELETE ADMIN ACCOUNT ──
router.delete("/delete-admin/:admin_id", requireDeveloper, async (req, res) => {
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
});

// ── GET EMPLOYEE ACCOUNTS LIST ──
router.get("/employees", requireDeveloper, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT employee_id, first_name, last_name, email, status, last_login FROM employees ORDER BY employee_id ASC"
    );
    res.json({ success: true, employees: rows });
  } catch (err) {
    console.error("Fetch employees error:", err);
    res.status(500).json({ error: "Failed to fetch employee accounts" });
  }
});

// ── CREATE / PROVISION EMPLOYEE ACCOUNT ──
router.post("/create-employee", requireDeveloper, async (req, res) => {
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
});

// ── INSTANT EMPLOYEE PASSWORD OVERRIDE ──
router.post("/reset-employee-password", requireDeveloper, async (req, res) => {
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
});

// ── UPDATE EMPLOYEE PROFILE ──
router.put("/update-employee", requireDeveloper, async (req, res) => {
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
});

// ── DELETE EMPLOYEE ACCOUNT ──
router.delete("/delete-employee/:employee_id", requireDeveloper, async (req, res) => {
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
});

// ── TEST FACEBOOK MESSENGER ALERT ──
const { sendMessengerAlert } = require("../services/messengerAlertService");

router.post("/test-messenger-alert", requireDeveloper, async (req, res) => {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  const psid = process.env.FB_RECIPIENT_PSID;

  if (!token || !psid) {
    return res.status(400).json({
      error: "Messenger variables not configured",
      message: "Please set FB_PAGE_ACCESS_TOKEN and FB_RECIPIENT_PSID in your back-end/.env file first.",
      configured: false,
    });
  }

  try {
    const result = await sendMessengerAlert(
      "Developer Panel Test Alert",
      "This is a test notification verifying that Facebook Messenger integration is working properly.",
      {
        route: "POST /api/developer/test-messenger-alert",
        user: "Developer Console (Manual Trigger)",
        ip: getClientIp(req),
      }
    );

    if (result.success) {
      addDeveloperLog("Dispatched test alert to Facebook Messenger", {
        type: "SYSTEM",
        device: parseDevice(req.headers["user-agent"]),
        ip: getClientIp(req),
      });

      return res.json({
        success: true,
        message: "Test alert successfully sent to your Facebook Messenger!",
        messageId: result.messageId,
      });
    }

    return res.status(502).json({
      error: "Meta API dispatch failed",
      message: result.error || "Failed to deliver message to Messenger",
    });
  } catch (err) {
    console.error("Test messenger alert error:", err);
    res.status(500).json({ error: "Server error while testing alert", message: err.message });
  }
});

// ── FETCH RECENT MESSENGER CONVERSATIONS ──
router.get("/messenger-conversations", requireDeveloper, async (req, res) => {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!token) {
    return res.status(400).json({ error: "FB_PAGE_ACCESS_TOKEN is not configured" });
  }

  try {
    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/me/conversations?fields=participants,updated_time,snippet&limit=25&access_token=${token}`
    );
    const data = await metaRes.json();

    if (!metaRes.ok || data.error) {
      return res.status(502).json({ error: data.error?.message || "Failed to fetch from Meta API" });
    }

    const state = readSystemStateFile();
    const dismissedPsids = new Set(state.dismissedMessengerPsids || []);

    const currentPsidRaw = process.env.FB_RECIPIENT_PSID || "";
    const activePsids = currentPsidRaw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const recipients = [];
    const seen = new Set();

    for (const conv of data.data || []) {
      for (const p of conv.participants?.data || []) {
        // Exclude the page itself and any dismissed/hidden users
        if (p.name !== "Golden Dragon" && !seen.has(p.id) && !dismissedPsids.has(p.id)) {
          seen.add(p.id);
          recipients.push({
            id: p.id,
            name: p.name || "Facebook User",
            email: p.email || "",
            lastActive: conv.updated_time,
            snippet: conv.snippet || "",
            isCurrent: activePsids.includes(p.id),
          });
        }
      }
    }

    res.json({
      success: true,
      recipients,
      activePsids,
      dismissedCount: dismissedPsids.size,
      currentRecipientPsid: currentPsidRaw,
    });
  } catch (err) {
    console.error("Fetch messenger conversations error:", err);
    res.status(500).json({ error: "Server error fetching conversations", message: err.message });
  }
});

// ── DISMISS / HIDE CONTACT FROM CONVERSATION SCAN ──
router.post("/dismiss-messenger-recipient", requireDeveloper, async (req, res) => {
  const { psid, name } = req.body;
  if (!psid) {
    return res.status(400).json({ error: "psid is required" });
  }

  try {
    const cleanPsid = psid.toString().trim();
    const cleanName = name ? name.toString().trim() : "User";
    const state = readSystemStateFile();
    const dismissed = new Set(state.dismissedMessengerPsids || []);
    dismissed.add(cleanPsid);

    // Also remove from active recipient list if it was active
    let activePsids = (process.env.FB_RECIPIENT_PSID || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((id) => id !== cleanPsid);

    const finalPsidStr = activePsids.join(",");
    process.env.FB_RECIPIENT_PSID = finalPsidStr;

    updateSystemStateFile({
      dismissedMessengerPsids: Array.from(dismissed),
      messengerRecipientPsid: finalPsidStr,
      messengerRecipientCount: activePsids.length,
    });

    addDeveloperLog(`Removed/Dismissed Messenger contact from scan list: ${cleanName} (${cleanPsid})`, {
      type: "SYSTEM",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });

    return res.json({
      success: true,
      message: `Contact ${cleanName} hidden from scan list`,
      activePsids,
    });
  } catch (err) {
    console.error("Dismiss messenger recipient error:", err);
    return res.status(500).json({ error: "Failed to dismiss recipient", message: err.message });
  }
});

// ── RESTORE ALL HIDDEN MESSENGER CONTACTS ──
router.post("/restore-messenger-recipients", requireDeveloper, async (req, res) => {
  try {
    updateSystemStateFile({
      dismissedMessengerPsids: [],
    });

    addDeveloperLog("Restored all hidden Messenger contacts in developer console", {
      type: "SYSTEM",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });

    return res.json({
      success: true,
      message: "Restored all hidden contacts to scan list!",
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to restore recipients", message: err.message });
  }
});

// ── TOGGLE OR SET ACTIVE MESSENGER ALERT RECIPIENT(S) ──
router.post("/set-messenger-recipient", requireDeveloper, async (req, res) => {
  const { psid, name, action } = req.body;
  if (!psid && !req.body.psids) {
    return res.status(400).json({ error: "psid is required" });
  }

  try {
    const currentPsidRaw = process.env.FB_RECIPIENT_PSID || "";
    let activePsids = currentPsidRaw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const cleanPsid = psid ? psid.toString().trim() : "";
    const cleanName = name ? name.toString().trim() : "Developer";

    let updatedMessage = "";
    if (action === "toggle") {
      if (activePsids.includes(cleanPsid)) {
        activePsids = activePsids.filter((id) => id !== cleanPsid);
        updatedMessage = `Removed ${cleanName} from alert broadcast list`;
      } else {
        activePsids.push(cleanPsid);
        updatedMessage = `Added ${cleanName} to alert broadcast list`;
      }
    } else {
      // Direct set or toggle if already in list
      if (!activePsids.includes(cleanPsid)) {
        activePsids.push(cleanPsid);
        updatedMessage = `Added ${cleanName} to alert receivers (${activePsids.length} active)`;
      } else {
        activePsids = activePsids.filter((id) => id !== cleanPsid);
        updatedMessage = `Removed ${cleanName} from alert receivers (${activePsids.length} remaining)`;
      }
    }

    const finalPsidStr = activePsids.join(",");

    // 1. Update runtime env
    process.env.FB_RECIPIENT_PSID = finalPsidStr;

    // 2. Persist to system_state.json
    updateSystemStateFile({
      messengerRecipientPsid: finalPsidStr,
      messengerRecipientCount: activePsids.length,
      lastModified: new Date().toISOString(),
    });

    // 3. Update .env files (root and back-end)
    const envPaths = [
      path.resolve(__dirname, "../../.env"),
      path.resolve(__dirname, "../../../.env"),
    ];

    envPaths.forEach((envPath) => {
      try {
        if (fs.existsSync(envPath)) {
          let envContent = fs.readFileSync(envPath, "utf8");
          if (envContent.includes("FB_RECIPIENT_PSID=")) {
            envContent = envContent.replace(/FB_RECIPIENT_PSID=.*/g, `FB_RECIPIENT_PSID=${finalPsidStr}`);
          } else {
            envContent += `\nFB_RECIPIENT_PSID=${finalPsidStr}\n`;
          }
          fs.writeFileSync(envPath, envContent, "utf8");
        }
      } catch (err) {
        console.warn("Could not write to .env:", err.message);
      }
    });

    addDeveloperLog(`Messenger alert recipients updated: ${finalPsidStr} (${activePsids.length} active)`, {
      type: "SYSTEM",
      device: parseDevice(req.headers["user-agent"]),
      ip: getClientIp(req),
    });

    return res.json({
      success: true,
      message: updatedMessage,
      activePsids,
      currentRecipientPsid: finalPsidStr,
    });
  } catch (err) {
    console.error("Set messenger recipient error:", err);
    return res.status(500).json({ error: "Failed to set recipient", message: err.message });
  }
});

// ── GET ALERT FILTER PREFERENCES ──
router.get("/alert-filters", requireDeveloper, (req, res) => {
  const state = readSystemStateFile();
  const filters = {
    criticalErrors: state.alertFilters?.criticalErrors ?? true,
    reservations: state.alertFilters?.reservations ?? true,
    authSecurity: state.alertFilters?.authSecurity ?? true,
    systemChanges: state.alertFilters?.systemChanges ?? true,
  };
  res.json({
    success: true,
    filters,
    messengerAlertsEnabled: state.messengerAlertsEnabled ?? true,
  });
});

// ── TOGGLE MASTER MESSENGER DISPATCH SWITCH (ON/OFF) ──
router.post("/toggle-messenger-master-switch", requireDeveloper, (req, res) => {
  const { enabled } = req.body;
  const isEnabled = typeof enabled === "boolean" ? enabled : true;

  updateSystemStateFile({
    messengerAlertsEnabled: isEnabled,
    lastModified: new Date().toISOString(),
  });

  addDeveloperLog(`Messenger automated dispatch set to: ${isEnabled ? "ENABLED (ON)" : "PAUSED (OFF)"}`, {
    type: "SYSTEM",
    device: parseDevice(req.headers["user-agent"]),
    ip: getClientIp(req),
  });

  res.json({
    success: true,
    messengerAlertsEnabled: isEnabled,
    message: `Messenger dispatch is now ${isEnabled ? "ENABLED" : "PAUSED"}!`,
  });
});

// ── SET ALERT FILTER PREFERENCES ──
router.post("/set-alert-filters", requireDeveloper, (req, res) => {
  const { filters } = req.body;
  if (!filters || typeof filters !== "object") {
    return res.status(400).json({ error: "filters object is required" });
  }

  const updatedFilters = {
    criticalErrors: Boolean(filters.criticalErrors),
    reservations: Boolean(filters.reservations),
    authSecurity: Boolean(filters.authSecurity),
    systemChanges: Boolean(filters.systemChanges),
  };

  updateSystemStateFile({
    alertFilters: updatedFilters,
    lastModified: new Date().toISOString(),
  });

  addDeveloperLog("Updated Messenger Alert notification category filters", {
    type: "SYSTEM",
    device: parseDevice(req.headers["user-agent"]),
    ip: getClientIp(req),
  });

  res.json({
    success: true,
    message: "Alert notification preferences saved successfully!",
    filters: updatedFilters,
  });
});

module.exports = router;

