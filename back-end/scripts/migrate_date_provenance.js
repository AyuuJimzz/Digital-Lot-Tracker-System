/**
 * Conservative, Data-Preserving Migration: Track Date Provenance & Verification for Transactions.
 *
 * Core Engineering Pillars:
 * 1. Zero Assumptions / Conservative Default:
 *    Never automatically assumes a legacy transaction is verified.
 *    Any transaction without an explicit verified `lots.sold_on` date is categorized as
 *    either 'unverified_backfill' (known synthetic backfill) or 'unknown_requires_review'.
 *    Both have `is_date_verified = 0`, keeping them out of dated charts until verified by staff.
 * 2. Plan Preview & Preflight Inspection:
 *    Inspects the database and outputs affected-row counts by category before applying changes.
 *    Supports `--plan` or `--dry-run` to inspect without making any writes.
 * 3. Idempotent & Non-Destructive:
 *    Preserves all original transaction rows, dates, notes, and customer IDs.
 *    Can be run multiple times safely without duplicate column errors or state corruption.
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
const defaultDb = require("../config/database_connection");
const { getDatabaseSslConfig } = require("../config/database_ssl");

async function computeMigrationPlan(database) {
  const [cols] = await database.query("SHOW COLUMNS FROM transactions LIKE 'date_provenance'");
  const hasDateProvCol = cols.length > 0;

  const reversalCondition = hasDateProvCol
    ? `(t.payment_type IN ('Reversal', 'Cancelled') OR COALESCE(t.notes, '') LIKE 'Reversal of Sale%' OR t.date_provenance = 'reversal')`
    : `(t.payment_type IN ('Reversal', 'Cancelled') OR COALESCE(t.notes, '') LIKE 'Reversal of Sale%')`;

  const backfillCondition = hasDateProvCol
    ? `((COALESCE(t.notes, '') = 'Reservation record' OR COALESCE(t.notes, '') LIKE 'Direct %' OR t.date_provenance = 'unverified_backfill' OR (t.payment_type = 'No Downpayment' AND (l.sold_on IS NULL OR CAST(l.sold_on AS CHAR) IN ('', '0000-00-00')))) AND t.date_provenance NOT IN ('manual_audit', 'system_recorded'))`
    : `(COALESCE(t.notes, '') = 'Reservation record' OR COALESCE(t.notes, '') LIKE 'Direct %' OR (t.payment_type = 'No Downpayment' AND (l.sold_on IS NULL OR CAST(l.sold_on AS CHAR) IN ('', '0000-00-00'))))`;

  const verifiedDateCondition = hasDateProvCol
    ? `(t.date_provenance IN ('manual_audit', 'system_recorded') OR (l.sold_on IS NOT NULL AND CAST(l.sold_on AS CHAR) NOT IN ('', '0000-00-00')))`
    : `(l.sold_on IS NOT NULL AND CAST(l.sold_on AS CHAR) NOT IN ('', '0000-00-00'))`;


  // Categories are strictly mutually exclusive and exhaustive:
  // 1. Reversals / Cancellations
  // 2. Known Backfills (synthetic) - NULL-safe on notes, preserves unverified_backfill, preserves legitimate No Downpayment sales
  // 3. Verified - explicit sold_on date or confirmed provenance (manual_audit / system_recorded preserved even if sale was reversed)
  // 4. Unknown Requires Review - lacks sold_on date (demoting previous flawed 'verified' labels)
  const [rows] = await database.query(`
    SELECT 
      COUNT(*) as total_transactions,
      SUM(CASE 
        WHEN ${reversalCondition} THEN 1 
        ELSE 0 
      END) as reversal_count,
      SUM(CASE 
        WHEN NOT (${reversalCondition}) 
          AND ${backfillCondition} THEN 1 
        ELSE 0 
      END) as known_backfill_count,
      SUM(CASE 
        WHEN NOT (${reversalCondition}) 
          AND NOT (${backfillCondition})
          AND ${verifiedDateCondition} THEN 1 
        ELSE 0 
      END) as verified_with_sold_on_count,
      SUM(CASE 
        WHEN NOT (${reversalCondition}) 
          AND NOT (${backfillCondition})
          AND NOT (${verifiedDateCondition}) THEN 1 
        ELSE 0 
      END) as unknown_requires_review_count
    FROM transactions t
    LEFT JOIN lots l ON t.lot_id = l.lot_id
  `);

  const stat = rows[0] || {};
  return {
    totalTransactions: Number(stat.total_transactions || 0),
    reversalCount: Number(stat.reversal_count || 0),
    knownBackfillCount: Number(stat.known_backfill_count || 0),
    verifiedWithSoldOnCount: Number(stat.verified_with_sold_on_count || 0),
    unknownRequiresReviewCount: Number(stat.unknown_requires_review_count || 0),
  };
}

function printPlanSummary(plan, isDryRun = false) {
  console.log("=============================================================================");
  console.log(isDryRun ? "📋 DATE PROVENANCE MIGRATION PLAN (DRY-RUN PREVIEW)" : "📋 PRE-MIGRATION AUDIT BREAKDOWN");
  console.log("=============================================================================");
  console.log(`Total Transactions in Database:      ${plan.totalTransactions}`);
  console.log(`- Verified (via explicit sold_on/audit/system): ${plan.verifiedWithSoldOnCount}  ➔ is_date_verified = 1, provenance = 'verified'/'system_recorded'/'manual_audit'`);
  console.log(`- Known Backfills (synthetic):       ${plan.knownBackfillCount}  ➔ is_date_verified = 0, provenance = 'unverified_backfill'`);
  console.log(`- Unknown (requires staff review):   ${plan.unknownRequiresReviewCount}  ➔ is_date_verified = 0, provenance = 'unknown_requires_review'`);
  console.log(`- Reversals / Cancellations:         ${plan.reversalCount}  ➔ is_date_verified = 0, provenance = 'reversal'`);
  console.log("=============================================================================\n");
}

async function migrateDateProvenance(options = {}) {
  const database = options.db || options.connection || defaultDb;
  const isDryRun = Boolean(options.dryRun || process.argv.includes("--dry-run") || process.argv.includes("--plan"));

  // 1. Calculate migration plan & affected counts
  const plan = await computeMigrationPlan(database);
  printPlanSummary(plan, isDryRun);

  // Preflight assertion: Mutually exclusive & exhaustive partitioning
  const sumCategories =
    plan.reversalCount +
    plan.knownBackfillCount +
    plan.verifiedWithSoldOnCount +
    plan.unknownRequiresReviewCount;
  if (sumCategories !== plan.totalTransactions) {
    throw new Error(
      `Partition mismatch: sum of categories (${sumCategories}) !== total transactions (${plan.totalTransactions})`
    );
  }

  if (isDryRun) {
    console.log("🛡️ Dry-run mode: ZERO schema changes or data modifications were made.\n");
    return { plan, applied: false, isDryRun: true };
  }

  // 2. Add columns with safe, conservative defaults: is_date_verified = 0, provenance = 'unknown_requires_review'
  const [colsVerified] = await database.query("SHOW COLUMNS FROM transactions LIKE 'is_date_verified'");
  if (colsVerified.length === 0) {
    try {
      await database.query(
        "ALTER TABLE transactions ADD COLUMN is_date_verified TINYINT(1) NOT NULL DEFAULT 0"
      );
      console.log("✅ Added column transactions.is_date_verified (DEFAULT 0).");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") throw err;
    }
  }

  const [colsProvenance] = await database.query("SHOW COLUMNS FROM transactions LIKE 'date_provenance'");
  if (colsProvenance.length === 0) {
    try {
      await database.query(
        "ALTER TABLE transactions ADD COLUMN date_provenance VARCHAR(50) NOT NULL DEFAULT 'unknown_requires_review'"
      );
      console.log("✅ Added column transactions.date_provenance (DEFAULT 'unknown_requires_review').");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") throw err;
    }
  }

  // 3. Explicitly categorize reversals as 'reversal' (is_date_verified = 0)
  const [reversalUpdate] = await database.query(`
    UPDATE transactions
    SET is_date_verified = 0, date_provenance = 'reversal'
    WHERE payment_type IN ('Reversal', 'Cancelled')
       OR COALESCE(notes, '') LIKE 'Reversal of Sale%'
  `);

  // 4. Explicitly categorize known synthetic backfills as 'unverified_backfill' (is_date_verified = 0)
  // Even if lots.sold_on is populated, preserve unverified_backfill until explicit staff verification.
  // Protects confirmed sales ('manual_audit', 'system_recorded') and legitimate No Downpayment sales with sold_on.
  const [backfillUpdate] = await database.query(`
    UPDATE transactions t
    LEFT JOIN lots l ON t.lot_id = l.lot_id
    SET t.is_date_verified = 0, t.date_provenance = 'unverified_backfill'
    WHERE t.payment_type NOT IN ('Reversal', 'Cancelled')
      AND COALESCE(t.notes, '') NOT LIKE 'Reversal of Sale%'
      AND t.date_provenance NOT IN ('manual_audit', 'system_recorded')
      AND (
        COALESCE(t.notes, '') = 'Reservation record'
        OR COALESCE(t.notes, '') LIKE 'Direct %'
        OR t.date_provenance = 'unverified_backfill'
        OR (t.payment_type = 'No Downpayment' AND (l.sold_on IS NULL OR CAST(l.sold_on AS CHAR) IN ('', '0000-00-00')))
      )
  `);

  // 5. Only mark as 'verified' if lot has an explicit verified sold_on date, not a backfill, not reversed.
  // Preserves existing explicit provenance ('manual_audit', 'system_recorded').
  const [verifiedUpdate] = await database.query(`
    UPDATE transactions t
    JOIN lots l ON t.lot_id = l.lot_id
    SET t.is_date_verified = 1,
        t.date_provenance = CASE 
          WHEN t.date_provenance IN ('manual_audit', 'system_recorded') THEN t.date_provenance 
          ELSE 'verified' 
        END
    WHERE l.sold_on IS NOT NULL 
      AND CAST(l.sold_on AS CHAR) NOT IN ('', '0000-00-00')
      AND t.payment_type NOT IN ('Reversal', 'Cancelled')
      AND COALESCE(t.notes, '') NOT LIKE 'Reversal of Sale%'
      AND t.date_provenance != 'unverified_backfill'
      AND COALESCE(t.notes, '') != 'Reservation record'
      AND COALESCE(t.notes, '') NOT LIKE 'Direct %'
  `);

  // 6. Ensure any legacy rows without sold_on are categorized as 'unknown_requires_review'
  // (Demotes flawed legacy 'verified' labels that lack sold_on and lack explicit provenance,
  // but strictly PRESERVES staff-verified 'manual_audit' and 'system_recorded' records even if the lot was later reversed and sold_on is NULL)
  const [unknownUpdate] = await database.query(`
    UPDATE transactions t
    LEFT JOIN lots l ON t.lot_id = l.lot_id
    SET t.is_date_verified = 0, t.date_provenance = 'unknown_requires_review'
    WHERE (l.sold_on IS NULL OR CAST(l.sold_on AS CHAR) IN ('', '0000-00-00'))
      AND t.payment_type NOT IN ('Reversal', 'Cancelled')
      AND COALESCE(t.notes, '') NOT LIKE 'Reversal of Sale%'
      AND t.date_provenance NOT IN ('unverified_backfill', 'manual_audit', 'system_recorded')
  `);

  // Reset column existence cache in memory if controllers are loaded
  try {
    const { resetDateVerifiedColumnCache: resetStatusCache } = require("../src/controllers/lots/lotStatusController");
    if (resetStatusCache) resetStatusCache();
  } catch (_) {}
  try {
    const { resetDateVerifiedColumnCache: resetAnalyticsCache } = require("../src/controllers/lots/lotAnalyticsController");
    if (resetAnalyticsCache) resetAnalyticsCache();
  } catch (_) {}

  console.log(`✅ Conservative migration applied successfully:`);
  console.log(`   - Verified rows updated:          ${verifiedUpdate.changedRows}`);
  console.log(`   - Known backfill rows updated:    ${backfillUpdate.changedRows}`);
  console.log(`   - Reversal rows updated:          ${reversalUpdate.changedRows}`);
  console.log(`   - Unknown rows requiring review:  ${plan.unknownRequiresReviewCount}\n`);

  return { plan, applied: true, isDryRun: false, isIdempotent: true };
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
    ssl: getDatabaseSslConfig(parsed.hostname, cleanUri.includes("ssl-mode") || process.env.DB_SSL === "true"),
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

  migrateDateProvenance({ db: targetDb })
    .then(() => console.log("Date provenance migration routine finished."))
    .catch((err) => {
      console.error("Migration failed:", err);
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

module.exports = { migrateDateProvenance, computeMigrationPlan, getCustomPool };
