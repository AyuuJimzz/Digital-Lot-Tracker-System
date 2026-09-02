const crypto = require("crypto");
const db = require("../../config/database_connection");

// Fast in-memory cache for concurrent session lookup (key: `${role}_${userId}`, value: sessionId)
const activeSessionMap = new Map();

// Self-healing schema migration: ensure active_session_id column exists
let isSchemaEnsured = false;
async function ensureSessionSchema() {
  if (isSchemaEnsured) return;
  try {
    const [adminCols] = await db.query("SHOW COLUMNS FROM admins LIKE 'active_session_id'");
    if (!adminCols.length) {
      await db.query("ALTER TABLE admins ADD COLUMN active_session_id VARCHAR(128) NULL");
    }

    const [empCols] = await db.query("SHOW COLUMNS FROM employees LIKE 'active_session_id'");
    if (!empCols.length) {
      await db.query("ALTER TABLE employees ADD COLUMN active_session_id VARCHAR(128) NULL");
    }

    const [custCols] = await db.query("SHOW COLUMNS FROM customers LIKE 'employee_id'");
    if (!custCols.length) {
      await db.query("ALTER TABLE customers ADD COLUMN employee_id INT NULL");
    }

    const [txCols] = await db.query("SHOW COLUMNS FROM transactions LIKE 'employee_id'");
    if (!txCols.length) {
      await db.query("ALTER TABLE transactions ADD COLUMN employee_id INT NULL");
    }

    const [custStatusCols] = await db.query("SHOW COLUMNS FROM customers LIKE 'customer_status'");
    if (!custStatusCols.length) {
      await db.query("ALTER TABLE customers ADD COLUMN customer_status VARCHAR(20) NULL DEFAULT 'Pending'");
      // Backfill: for lots with multiple customers, mark older ones as Cancelled (keep newest as Pending)
      await db.query(`
        UPDATE customers c
        INNER JOIN (
          SELECT lot_id, MAX(customer_id) as latest_id
          FROM customers
          GROUP BY lot_id
          HAVING COUNT(*) > 1
        ) latest ON c.lot_id = latest.lot_id AND c.customer_id != latest.latest_id
        SET c.customer_status = 'Cancelled'
        WHERE c.customer_status IS NULL OR c.customer_status = 'Pending'
      `);
    }

    // Ensure every customer record has a corresponding transaction row for audit & history
    await db.query(`
      INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, transaction_date)
      SELECT c.lot_id, c.customer_id, 'No Downpayment', 'Reservation record', c.employee_id, COALESCE(c.created_at, NOW())
      FROM customers c
      LEFT JOIN transactions t ON c.customer_id = t.customer_id
      WHERE t.transaction_id IS NULL AND c.lot_id IS NOT NULL
    `);

    isSchemaEnsured = true;
  } catch (err) {
    console.warn("Session schema ensure notice:", err.message);
  }
}

// Run schema ensure on startup
ensureSessionSchema();

/**
 * Creates and registers a new active session for the user,
 * automatically invalidating any previous device's session.
 *
 * @param {string} role - 'admin' or 'employee'
 * @param {number|string} userId - admin_id or employee_id
 * @returns {Promise<string>} - The newly minted unique sessionId
 */
async function createSession(role, userId) {
  await ensureSessionSchema();
  const sessionId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
  const key = `${role.toLowerCase()}_${userId}`;

  // 1. Update in-memory cache
  activeSessionMap.set(key, sessionId);

  // 2. Persist in database
  try {
    if (role.toLowerCase() === "admin") {
      await db.query("UPDATE admins SET active_session_id = ? WHERE admin_id = ?", [sessionId, userId]);
    } else {
      await db.query("UPDATE employees SET active_session_id = ? WHERE employee_id = ?", [sessionId, userId]);
    }
  } catch (err) {
    console.warn("Failed to persist active_session_id in DB:", err.message);
  }

  return sessionId;
}

/**
 * Verifies if the provided sessionId matches the user's currently active session.
 *
 * @param {string} role - 'admin' or 'employee'
 * @param {number|string} userId - admin_id or employee_id
 * @param {string} tokenSessionId - sessionId encoded inside the incoming JWT or session
 * @returns {Promise<boolean>}
 */
async function isValidSession(role, userId, tokenSessionId) {
  if (!tokenSessionId) return true; // Graceful fallback if no session ID in legacy token
  await ensureSessionSchema();

  const key = `${role.toLowerCase()}_${userId}`;

  // 1. Fast in-memory check
  if (activeSessionMap.has(key)) {
    const cachedId = activeSessionMap.get(key);
    return cachedId === tokenSessionId;
  }

  // 2. Fallback DB check (e.g. server restart or multi-instance)
  try {
    let query = "SELECT active_session_id FROM employees WHERE employee_id = ?";
    if (role.toLowerCase() === "admin") {
      query = "SELECT active_session_id FROM admins WHERE admin_id = ?";
    }
    const [rows] = await db.query(query, [userId]);
    if (rows.length > 0 && rows[0].active_session_id) {
      const dbSessionId = rows[0].active_session_id;
      activeSessionMap.set(key, dbSessionId); // populate cache
      return dbSessionId === tokenSessionId;
    }
  } catch (err) {
    console.warn("Session validation DB query notice:", err.message);
  }

  // If no session found in DB, accept provided token
  return true;
}

/**
 * Invalidates the active session upon explicit user logout.
 */
async function invalidateSession(role, userId) {
  if (!role || !userId) return;
  const key = `${role.toLowerCase()}_${userId}`;
  activeSessionMap.delete(key);

  try {
    if (role.toLowerCase() === "admin") {
      await db.query("UPDATE admins SET active_session_id = NULL WHERE admin_id = ?", [userId]);
    } else {
      await db.query("UPDATE employees SET active_session_id = NULL WHERE employee_id = ?", [userId]);
    }
  } catch (err) {}
}

module.exports = {
  createSession,
  isValidSession,
  invalidateSession,
};
