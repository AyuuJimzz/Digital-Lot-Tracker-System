const crypto = require("crypto");
const db = require("../../config/database_connection");

// Fast in-memory cache for concurrent session lookup (key: `${role}_${userId}`, value: sessionId)
const activeSessionMap = new Map();

/**
 * Creates and registers a new active session for the user,
 * automatically invalidating any previous device's session.
 *
 * @param {string} role - 'admin' or 'employee'
 * @param {number|string} userId - admin_id or employee_id
 * @returns {Promise<string>} - The newly minted unique sessionId
 */
async function createSession(role, userId) {
  const sessionId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
  const key = `${role.toLowerCase()}_${userId}`;

  // Persist before issuing a JWT so a failed database write cannot create an
  // apparently valid session that disappears after a restart.
  const [result] = role.toLowerCase() === "admin"
    ? await db.query("UPDATE admins SET active_session_id = ? WHERE admin_id = ?", [sessionId, userId])
    : await db.query("UPDATE employees SET active_session_id = ? WHERE employee_id = ? AND status = 'active'", [sessionId, userId]);
  if (result.affectedRows !== 1) throw new Error("Unable to create an active session");
  activeSessionMap.set(key, sessionId);

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

  const normalizedRole = role.toLowerCase();
  const key = `${normalizedRole}_${userId}`;

  // Employee deactivation must take effect even if another process changed the
  // database; an in-memory hit alone cannot prove that the account is active.
  if (normalizedRole === "employee") {
    try {
      const [rows] = await db.query(
        "SELECT active_session_id, status FROM employees WHERE employee_id = ?",
        [userId]
      );
      return rows.length > 0 && rows[0].status === "active" && rows[0].active_session_id === tokenSessionId;
    } catch (err) {
      console.warn("Employee session validation DB query notice:", err.message);
      return false;
    }
  }

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

  // Missing or unavailable session state must not revive an expired token.
  return false;
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

function clearCachedSession(role, userId) {
  activeSessionMap.delete(`${role.toLowerCase()}_${userId}`);
}

module.exports = {
  createSession,
  isValidSession,
  invalidateSession,
  clearCachedSession,
};
