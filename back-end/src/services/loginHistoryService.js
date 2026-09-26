const crypto = require("crypto");
const db = require("../../config/database_connection");
const { parseDevice } = require("./loggerService");

const validRoles = new Set(["admin", "employee"]);

const hashSession = (sessionId) =>
  crypto.createHash("sha256").update(String(sessionId)).digest("hex");

async function recordLogin(req, user) {
  if (!validRoles.has(user.role) || !user.id || !user.sessionId) return;

  const device = parseDevice(req.get("user-agent") || "").slice(0, 100);
  // Express respects the configured trusted proxy; the raw X-Forwarded-For
  // header is not trusted here because clients can supply it themselves.
  const ipAddress = (req.ip || req.socket?.remoteAddress || "").replace(/^::ffff:/, "").slice(0, 45) || null;

  await db.query(
    `INSERT INTO account_login_history
      (account_role, account_id, session_hash, device, ip_address)
     VALUES (?, ?, ?, ?, ?)`,
    [user.role, user.id, hashSession(user.sessionId), device, ipAddress]
  );
  await db.query(
    `DELETE FROM account_login_history
     WHERE account_role = ? AND account_id = ?
       AND signed_in_at < NOW() - INTERVAL 90 DAY`,
    [user.role, user.id]
  );
}

async function getLoginHistory(user) {
  if (!validRoles.has(user.role) || !user.id) return [];

  const [rows] = await db.query(
    `SELECT login_id, session_hash, device, ip_address, signed_in_at
     FROM account_login_history
     WHERE account_role = ? AND account_id = ?
       AND signed_in_at >= NOW() - INTERVAL 90 DAY
     ORDER BY signed_in_at DESC, login_id DESC
     LIMIT 10`,
    [user.role, user.id]
  );
  const currentHash = user.sessionId ? hashSession(user.sessionId) : null;

  return rows.map(({ session_hash, ...row }) => ({
    ...row,
    is_current: session_hash === currentHash,
  }));
}

module.exports = { recordLogin, getLoginHistory };
