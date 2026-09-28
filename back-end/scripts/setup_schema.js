/**
 * Explicit database setup/migration step.
 *
 * This is intentionally not imported by the web server. Run it deliberately
 * against the intended database before starting a new deployment.
 */
const defaultDb = require("../config/database_connection");
const { migrateNonSaleableColumn } = require("./migrate_non_saleable_column");
const { migrateLoginHistory } = require("./migrate_login_history");
const { migrateSaleDateAudit } = require("./migrate_sale_date_audit");

const statements = [
  `CREATE TABLE IF NOT EXISTS system_state (
    state_key VARCHAR(100) NOT NULL PRIMARY KEY,
    state_value LONGTEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  "ALTER TABLE customers ADD COLUMN is_demo TINYINT(1) DEFAULT 0",
  "ALTER TABLE transactions ADD COLUMN is_demo TINYINT(1) DEFAULT 0",
  "ALTER TABLE transactions ADD COLUMN agent_name VARCHAR(255) DEFAULT NULL",
  "ALTER TABLE admins ADD COLUMN active_session_id VARCHAR(128) NULL",
  "ALTER TABLE employees ADD COLUMN active_session_id VARCHAR(128) NULL",
  "ALTER TABLE customers ADD COLUMN employee_id INT NULL",
  "ALTER TABLE transactions ADD COLUMN employee_id INT NULL",
  "ALTER TABLE customers ADD COLUMN customer_status VARCHAR(20) NULL DEFAULT 'Pending'",
  "ALTER TABLE lots ADD COLUMN is_non_saleable TINYINT(1) DEFAULT 0",
  // Existing sold lots stay NULL: a reservation/transaction date is not proof of the sale date.
  "ALTER TABLE lots ADD COLUMN sold_on DATE NULL DEFAULT NULL",
  "ALTER TABLE transactions ADD COLUMN is_date_verified TINYINT(1) NOT NULL DEFAULT 0",
  "ALTER TABLE transactions ADD COLUMN date_provenance VARCHAR(50) NOT NULL DEFAULT 'unknown_requires_review'",
];

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

async function setupSchema(options = {}) {
  const database = options.db || defaultDb;
  let isNonSaleableNewlyAdded = false;
  for (const statement of statements) {
    try {
      await database.query(statement);
      console.log(`Applied: ${statement}`);
      if (statement.includes("is_non_saleable")) isNonSaleableNewlyAdded = true;
    } catch (error) {
      if (error.code === "ER_DUP_FIELDNAME") {
        console.log(`Already present: ${statement}`);
      } else {
        throw error;
      }
    }
  }

  await migrateLoginHistory({ db: database });
  await migrateSaleDateAudit({ db: database });

  await database.query(`
    UPDATE customers c
    INNER JOIN (
      SELECT lot_id, MAX(customer_id) AS latest_id
      FROM customers
      GROUP BY lot_id
      HAVING COUNT(*) > 1
    ) latest ON c.lot_id = latest.lot_id AND c.customer_id != latest.latest_id
    SET c.customer_status = 'Cancelled'
    WHERE c.customer_status IS NULL
  `);

  await database.query(`
    UPDATE transactions t
    JOIN employees e ON t.employee_id = e.employee_id
    SET t.agent_name = TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')))
    WHERE (t.agent_name IS NULL OR t.agent_name = '') AND t.employee_id IS NOT NULL
  `);

  await database.query(`
    INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, transaction_date, is_date_verified, date_provenance)
    SELECT c.lot_id, c.customer_id, 'No Downpayment', 'Reservation record', c.employee_id, COALESCE(c.created_at, NOW()), 0, 'unverified_backfill'
    FROM customers c
    LEFT JOIN transactions t ON c.customer_id = t.customer_id
    WHERE t.transaction_id IS NULL AND c.lot_id IS NOT NULL
  `);

  await database.query(`
    INSERT INTO transactions (lot_id, customer_id, payment_type, notes, transaction_date, is_date_verified, date_provenance)
    SELECT l.lot_id, NULL, 'No Downpayment', CONCAT('Direct ', l.status, ' record'), COALESCE(l.pending_since, NOW()), 0, 'unverified_backfill'
    FROM lots l
    LEFT JOIN transactions t ON l.lot_id = t.lot_id
    WHERE t.transaction_id IS NULL AND l.status IN ('Sold', 'Pending')
  `);

  // Initial backfill uses the guarded migration and its saved exclusion list.
  // Never reclassify existing manually edited flags on subsequent setup runs.
  if (isNonSaleableNewlyAdded) {
    const migration = await migrateNonSaleableColumn({ db: database });
    if (!migration.completedWithoutConflicts) {
      throw new Error(`Non-saleable migration has ${migration.totalUnresolved} unresolved status conflict(s).`);
    }
  } else {
    console.log("Preserved existing lot classifications; run the dedicated migration explicitly if needed.");
  }
}

if (require.main === module) {
  const uriArg = process.argv.find(
    (a) => a.startsWith("mysql://") || a.startsWith("mysqls://") || a.includes("aivencloud.com")
  );
  const targetDb = uriArg ? getCustomPool(uriArg) : defaultDb;

  setupSchema({ db: targetDb })
    .then(async () => {
      console.log("Database setup completed.");
      try {
        if (uriArg && targetDb) await targetDb.end();
      } catch (_) {}
      try {
        await defaultDb.end();
      } catch (_) {}
    })
    .catch(async (error) => {
      console.error("Database setup failed:", error.message);
      try {
        if (uriArg && targetDb) await targetDb.end();
      } catch (_) {}
      try {
        await defaultDb.end();
      } catch (_) {}
      process.exitCode = 1;
    });

}

module.exports = { setupSchema };
