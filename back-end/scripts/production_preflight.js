/**
 * Read-only release gate. Does not create, alter, or update database records.
 * Run against the intended staging/production DB after verifying the target.
 */
const requiredColumns = {
  properties: ["property_id"],
  admins: ["admin_id", "active_session_id"],
  employees: ["employee_id", "active_session_id"],
  customers: ["customer_id", "lot_id", "customer_status", "employee_id"],
  lots: ["lot_id", "property_id", "status", "is_non_saleable", "sold_on"],
  transactions: ["transaction_id", "lot_id", "customer_id", "transaction_date", "payment_type", "is_date_verified", "date_provenance", "employee_id"],
  system_state: ["state_key"],
  sale_date_audit: ["audit_id"],
  account_login_history: ["login_id"],
};

async function inspectDatabase(database) {
  const [columns] = await database.query(
    "SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE()",
  );
  const present = new Map();
  for (const row of columns) {
    const table = String(row.TABLE_NAME).toLowerCase();
    if (!present.has(table)) present.set(table, new Set());
    present.get(table).add(String(row.COLUMN_NAME).toLowerCase());
  }

  const missingSchema = [];
  for (const [table, fields] of Object.entries(requiredColumns)) {
    if (!present.has(table)) {
      missingSchema.push(`table ${table}`);
      continue;
    }
    for (const field of fields) {
      if (!present.get(table).has(field)) missingSchema.push(`${table}.${field}`);
    }
  }

  const counts = {};
  if (missingSchema.length === 0) {
    const [lotRows] = await database.query(`
      SELECT
        SUM(CASE WHEN is_non_saleable = 1 AND status IN ('Pending', 'Sold') THEN 1 ELSE 0 END) AS non_saleable_reserved_or_sold,
        SUM(CASE WHEN status = 'Sold' AND (sold_on IS NULL OR CAST(sold_on AS CHAR) = '0000-00-00') THEN 1 ELSE 0 END) AS undated_sold_lots
      FROM lots
    `);
    const [transactionRows] = await database.query(`
      SELECT
        SUM(CASE WHEN is_date_verified = 1 AND (transaction_date IS NULL OR date_provenance IS NULL OR date_provenance NOT IN ('verified', 'manual_audit', 'system_recorded')) THEN 1 ELSE 0 END) AS invalid_verified_dates,
        SUM(CASE WHEN payment_type IN ('Reversal', 'Cancelled') AND is_date_verified = 1 THEN 1 ELSE 0 END) AS verified_reversals
      FROM transactions
    `);
    for (const row of [lotRows[0], transactionRows[0]]) {
      for (const [key, value] of Object.entries(row)) counts[key] = Number(value || 0);
    }
  }

  const blockingCounts = [
    "non_saleable_reserved_or_sold",
    "invalid_verified_dates",
    "verified_reversals",
  ];
  return {
    ready: missingSchema.length === 0 && blockingCounts.every((key) => counts[key] === 0),
    missingSchema,
    counts,
  };
}

if (require.main === module) {
  const database = require("../config/database_connection");
  inspectDatabase(database)
    .then((result) => {
      console.log("Production preflight (read-only):", result.ready ? "PASS" : "FAIL");
      if (result.missingSchema.length) console.log("Missing schema:", result.missingSchema.join(", "));
      if (Object.keys(result.counts).length) console.log("Aggregate counts:", result.counts);
      if (result.counts.undated_sold_lots) {
        console.log("Note: undated sold lots require staff review but are not counted as dated sales.");
      }
      if (!result.ready) process.exitCode = 1;
    })
    .catch((error) => {
      console.error("Production preflight failed:", error.message);
      process.exitCode = 1;
    })
    .finally(() => database.end());
}

module.exports = { inspectDatabase };
