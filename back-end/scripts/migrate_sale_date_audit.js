/**
 * Additive audit storage for staff corrections to already-sold lot dates.
 * Run explicitly before deploying the corresponding backend controller.
 * This migration does not modify existing lots or transactions.
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
const defaultDb = require("../config/database_connection");

const createSaleDateAuditTable = `
  CREATE TABLE IF NOT EXISTS sale_date_audit (
    audit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    lot_id BIGINT NOT NULL,
    transaction_id BIGINT NULL,
    action VARCHAR(30) NOT NULL,
    previous_sold_on VARCHAR(10) NULL,
    new_sold_on VARCHAR(10) NULL,
    previous_transaction_date VARCHAR(32) NULL,
    new_transaction_date VARCHAR(32) NULL,
    previous_is_date_verified TINYINT(1) NULL,
    new_is_date_verified TINYINT(1) NOT NULL,
    previous_date_provenance VARCHAR(50) NULL,
    new_date_provenance VARCHAR(50) NOT NULL,
    changed_by_role VARCHAR(20) NOT NULL,
    changed_by_user_id BIGINT NULL,
    changed_by_email VARCHAR(255) NULL,
    changed_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_sale_date_audit_lot (lot_id, audit_id),
    INDEX idx_sale_date_audit_transaction (transaction_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

async function migrateSaleDateAudit({ db = defaultDb } = {}) {
  await db.query(createSaleDateAuditTable);
}

function getCustomPool(uriString) {
  const mysql = require("mysql2");
  const cleanUri = uriString.trim().replace(/^['"]|['"]$/g, "");
  const parsed = new URL(cleanUri);
  return mysql.createPool({
    host: parsed.hostname,
    port: parseInt(parsed.port || "3306"),
    user: decodeURIComponent(parsed.username || "avnadmin"),
    password: decodeURIComponent(parsed.password || ""),
    database: parsed.pathname.replace(/^\//, "") || "defaultdb",
    ssl: (parsed.hostname.includes("aivencloud.com") || cleanUri.includes("ssl-mode") || process.env.DB_SSL === "true")
      ? { rejectUnauthorized: false }
      : undefined,
    waitForConnections: true,
    connectionLimit: 6,
  }).promise();
}

if (require.main === module) {
  const uriArg = process.argv.find(
    (a) => a.startsWith("mysql://") || a.startsWith("mysqls://") || a.includes("aivencloud.com")
  ) || (process.argv.includes("--cloud") && process.env.AIVEN_SERVICE_URI ? process.env.AIVEN_SERVICE_URI : null);
  console.log("Target Database:", uriArg ? "Aiven Cloud Database" : "Local Default Database");
  const targetDb = uriArg ? getCustomPool(uriArg) : defaultDb;

  migrateSaleDateAudit({ db: targetDb })
    .then(async () => {
      const [check] = await targetDb.query("SHOW TABLES LIKE 'sale_date_audit'");
      console.log(`✅ sale_date_audit is ready on ${uriArg ? "Aiven Cloud" : "Local"} (verified: ${check.length > 0}).`);
    })
    .catch((error) => {
      console.error("Sale-date audit migration failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      try {
        if (uriArg && targetDb) await targetDb.end();
      } catch (_) {}
      try {
        await defaultDb.end();
      } catch (_) {}
    });
}

module.exports = { migrateSaleDateAudit };
