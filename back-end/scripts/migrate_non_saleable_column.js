/**
 * Dedicated, surgical migration script for the `is_non_saleable` column in the `lots` table.
 * 
 * Safety & Resilience Features:
 * 1. Truly Read-Only Dry-Run:
 *    When run with `--dry-run`, only read-only schema inspections and SELECT queries are executed.
 *    ZERO DDL (no CREATE TABLE, no ALTER TABLE) and ZERO DML (no INSERT, UPDATE, DELETE).
 *    If `system_state` table does not exist, dry-run treats stored exclusions as empty [] and reports this clearly.
 * 2. Primary-Key Targeted Updates with Status Guard:
 *    Backfills ONLY matching candidate lot IDs (`WHERE lot_id IN (?) AND status = 'Available'`).
 *    Never updates a lot with 'Pending' or 'Sold' status, preventing invalid reservations or sales on non-saleable lots.
 * 3. Status Preflight Check:
 *    Detects any candidate lot with active status ('Pending' or 'Sold') and automatically BLOCKS it
 *    from migration, outputting a high-visibility conflict alert table for administrative review.
 * 4. Migration Exclusion List (--exclude-ids):
 *    Clarification of Semantics:
 *    - `--exclude-ids` is a migration skip-list: it instructs this migration script NOT to flag these specific lot IDs as 1.
 *    - It does NOT automatically turn an existing 1 back to 0.
 *    - It does NOT block manual API edits or future custom updates from setting `is_non_saleable`.
 *    - In live mode, the skip-list is saved in `system_state` so subsequent runs of this migration script will continue to skip them.
 * 5. Unresolved Conflict Reporting:
 *    If any candidate lots are skipped (due to preflight 'Pending'/'Sold' status or write-time status change),
 *    the migration script explicitly reports an unresolved conflict state and refuses to claim full success.
 * 6. Testable Architecture:
 *    Accepts injected database connection and options, enabling direct automated testing without duplicated logic.
 * 
 * Usage:
 *   node scripts/migrate_non_saleable_column.js --dry-run                 # Read-only preview of candidate lots
 *   node scripts/migrate_non_saleable_column.js                           # Safe live execution
 *   node scripts/migrate_non_saleable_column.js --exclude-ids=101,102     # Add lot IDs to migration skip-list
 *   node scripts/migrate_non_saleable_column.js --remove-exclude-ids=101  # Remove lot ID from migration skip-list
 *   node scripts/migrate_non_saleable_column.js --clear-exclusions        # Clear migration skip-list
 */
const defaultDb = require("../config/database_connection");
const { NON_SALEABLE_REGEX } = require("../src/utils/lotClassification");

// Parse CLI exclusion arguments
const parseIdList = (argName) => {
  const arg = process.argv.find((a) => a.startsWith(`${argName}=`));
  if (!arg) return [];
  return arg
    .split("=")[1]
    .split(",")
    .map((id) => Number(id.trim()))
    .filter((id) => !isNaN(id) && id > 0);
};

/**
 * Checks if a table exists in the current database schema without modifying anything.
 */
async function checkTableExists(db, tableName) {
  const [rows] = await db.query(`
    SELECT TABLE_NAME 
    FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = ?
  `, [tableName]);
  return rows.length > 0;
}

/**
 * Ensures system_state table exists. ONLY called in LIVE mode.
 */
async function ensureSystemStateTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS system_state (
      state_key VARCHAR(100) NOT NULL PRIMARY KEY,
      state_value LONGTEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

/**
 * Loads saved migration exclusions from system_state table if the table exists.
 */
async function loadSavedExclusions(db, tableExists) {
  if (!tableExists) return [];
  const [rows] = await db.query(
    "SELECT state_value FROM system_state WHERE state_key = 'non_saleable_manual_exclusions'"
  );
  if (rows.length === 0) return [];
  try {
    const parsed = JSON.parse(rows[0].state_value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("⚠️ Warning: Failed to parse migration exclusions from system_state:", err.message);
    return [];
  }
}

/**
 * Saves migration exclusions to system_state table. ONLY called in LIVE mode.
 */
async function saveSavedExclusions(db, exclusionIds) {
  await db.query(
    `INSERT INTO system_state (state_key, state_value) 
     VALUES ('non_saleable_manual_exclusions', ?)
     ON DUPLICATE KEY UPDATE state_value = VALUES(state_value)`,
    [JSON.stringify(exclusionIds)]
  );
}

/**
 * Main migration execution function.
 * @param {object} options - Optional configuration for programmatic/test usage
 * @param {object} options.db - Optional custom database pool/connection
 * @param {boolean} options.isDryRun - Override dry-run mode
 * @param {number[]} options.cliExcludeIds - Explicit list of IDs to exclude
 * @param {number[]} options.cliRemoveIds - Explicit list of IDs to remove from exclusions
 * @param {boolean} options.isClearExclusions - Explicitly clear all exclusions
 * @param {object} options.logger - Optional custom logger (defaults to console)
 */
async function migrateNonSaleableColumn(options = {}) {
  const activeDb = options.db || options.pool || defaultDb;
  const isDryRun = options.isDryRun !== undefined ? Boolean(options.isDryRun) : process.argv.includes("--dry-run");
  const isClearExclusions = options.isClearExclusions !== undefined ? Boolean(options.isClearExclusions) : process.argv.includes("--clear-exclusions");
  const cliExcludeIds = options.cliExcludeIds || parseIdList("--exclude-ids");
  const cliRemoveIds = options.cliRemoveIds || parseIdList("--remove-exclude-ids");
  const logger = options.logger || console;

  logger.log(`\n🚀 Starting surgical migration for 'lots.is_non_saleable' [Mode: ${isDryRun ? "DRY-RUN (100% Read-Only Preview)" : "LIVE EXECUTION"}]`);

  // 1. Schema Inspection (Pure read-only): Check if system_state table exists
  const systemStateTableExists = await checkTableExists(activeDb, "system_state");
  if (!systemStateTableExists) {
    logger.log(`ℹ️  Schema status: 'system_state' table DOES NOT exist.`);
    if (isDryRun) {
      logger.log(`   (Read-only dry-run will not create it; table will only be created during live execution).`);
    }
  } else {
    logger.log(`ℹ️  Schema status: 'system_state' table exists.`);
  }

  // Load saved exclusions if table exists; otherwise treat as empty []
  const existingSavedExclusions = await loadSavedExclusions(activeDb, systemStateTableExists);

  let effectiveExclusionSet = new Set(existingSavedExclusions);
  if (isClearExclusions) {
    effectiveExclusionSet.clear();
    logger.log("🧹 Command Flag Detected: Clearing all migration exclusions.");
  } else {
    cliExcludeIds.forEach((id) => effectiveExclusionSet.add(id));
    cliRemoveIds.forEach((id) => effectiveExclusionSet.delete(id));
  }
  const effectiveExcludedIds = Array.from(effectiveExclusionSet).sort((a, b) => a - b);

  if (existingSavedExclusions.length > 0) {
    logger.log(`🛡️  Saved Migration Skip-List Loaded from 'system_state': [${existingSavedExclusions.join(", ")}]`);
  } else {
    logger.log(`ℹ️  Saved Migration Skip-List in DB: [] (None)`);
  }
  if (cliExcludeIds.length > 0) {
    logger.log(`➕ Newly Requested to Skip via CLI: [${cliExcludeIds.join(", ")}]`);
  }
  if (cliRemoveIds.length > 0) {
    logger.log(`➖ Requested Removals from Skip-List: [${cliRemoveIds.join(", ")}]`);
  }
  if (effectiveExcludedIds.length > 0) {
    logger.log(`🔒 Effective Migration Skip-List: [${effectiveExcludedIds.join(", ")}] (These lots will be skipped by this migration script)`);
  }

  // 2. Schema Inspection (Pure read-only): Check if column already exists in lots table
  const [columns] = await activeDb.query(`
    SELECT COLUMN_NAME 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'lots' 
      AND COLUMN_NAME = 'is_non_saleable'
  `);
  const columnExists = columns.length > 0;
  logger.log(`ℹ️  Schema status: 'lots.is_non_saleable' column ${columnExists ? "ALREADY EXISTS" : "DOES NOT EXIST (will be added in live mode)"}.`);

  // 3. Fetch all lots from database
  const [allLots] = await activeDb.query(`
    SELECT 
      lot_id, 
      property_id, 
      lot_number, 
      status, 
      ${columnExists ? "is_non_saleable" : "0 AS is_non_saleable"}
    FROM lots 
    ORDER BY property_id, lot_number
  `);

  // 4. Find candidates using the authoritative word-boundary JS regex
  const candidateLots = allLots.filter((lot) => NON_SALEABLE_REGEX.test(lot.lot_number));

  // 5. Categorize candidate lots with Status Preflight and Skip-List checks
  const migrationExcluded = candidateLots.filter((lot) => effectiveExcludedIds.includes(lot.lot_id));
  const activeCandidates = candidateLots.filter((lot) => !effectiveExcludedIds.includes(lot.lot_id));

  // Status Preflight: Active status ('Pending' or 'Sold') cannot be flagged as non-saleable!
  const statusConflicts = activeCandidates.filter((lot) => lot.status !== "Available");
  const validCandidates = activeCandidates.filter((lot) => lot.status === "Available");

  const alreadyFlagged = validCandidates.filter((lot) => Number(lot.is_non_saleable) === 1);
  const pendingMigration = validCandidates.filter((lot) => Number(lot.is_non_saleable) !== 1);

  // 6. Summary Report
  logger.log(`\n📋 [Candidate Analysis & Preflight Summary]:`);
  logger.log(`   - Total parcels in table: ${allLots.length}`);
  logger.log(`   - Total non-saleable keyword matches: ${candidateLots.length}`);
  logger.log(`   - Already flagged & Available (is_non_saleable = 1): ${alreadyFlagged.length}`);
  logger.log(`   - Pending migration (is_non_saleable = 0, Available): ${pendingMigration.length}`);
  logger.log(`   - Migration skip-list (Skipped from this migration): ${migrationExcluded.length}`);
  logger.log(`   - Status preflight conflicts (Blocked from migration): ${statusConflicts.length}`);

  // 7. Display Detailed Categorization Tables
  if (statusConflicts.length > 0) {
    logger.log(`\n🚨 [STATUS CONFLICT PREFLIGHT ALERT]: Found ${statusConflicts.length} candidate lot(s) with active status ('Pending' or 'Sold')!`);
    logger.log(`   ⚠️  THESE LOTS ARE BLOCKED FROM AUTOMATIC MIGRATION to protect active reservations/sales.`);
    logger.table(
      statusConflicts.map((l) => ({
        lot_id: l.lot_id,
        property_id: l.property_id,
        lot_number: l.lot_number,
        current_status: l.status,
        current_is_non_saleable: l.is_non_saleable,
        guard_reason: "BLOCKED: Status is not 'Available'",
      }))
    );
  }

  if (pendingMigration.length > 0) {
    logger.log(`\n🟡 [PENDING MIGRATION]: ${pendingMigration.length} candidate lot(s) eligible to be set to is_non_saleable = 1:`);
    logger.table(
      pendingMigration.map((l) => ({
        lot_id: l.lot_id,
        property_id: l.property_id,
        lot_number: l.lot_number,
        current_status: l.status,
        current_is_non_saleable: l.is_non_saleable,
      }))
    );
  }

  if (alreadyFlagged.length > 0) {
    logger.log(`\n🟢 [ALREADY FLAGGED]: ${alreadyFlagged.length} candidate lot(s) already flagged and confirmed:`);
    logger.table(
      alreadyFlagged.map((l) => ({
        lot_id: l.lot_id,
        property_id: l.property_id,
        lot_number: l.lot_number,
        current_status: l.status,
        current_is_non_saleable: l.is_non_saleable,
      }))
    );
  }

  if (migrationExcluded.length > 0) {
    logger.log(`\n⚪ [MIGRATION EXCLUSIONS]: ${migrationExcluded.length} lot(s) in skip-list (Will NOT be flagged as 1):`);
    logger.table(
      migrationExcluded.map((l) => ({
        lot_id: l.lot_id,
        property_id: l.property_id,
        lot_number: l.lot_number,
        current_status: l.status,
        current_is_non_saleable: l.is_non_saleable,
        action: "SKIPPED_BY_MIGRATION",
      }))
    );
  }

  // 8. Handle Dry-Run Mode (Guaranteed 0 Writes / 0 DDL)
  if (isDryRun) {
    logger.log(`\n🔍 [DRY-RUN COMPLETE]: 0 database writes executed.`);
    if (cliExcludeIds.length > 0 || cliRemoveIds.length > 0 || isClearExclusions) {
      logger.log(`ℹ️  [Skip-List Preview]: Running live will record effective skip-list [${effectiveExcludedIds.join(", ")}] in 'system_state'.`);
    }
    if (statusConflicts.length > 0) {
      logger.log(`⚠️  [UNRESOLVED CONFLICTS]: ${statusConflicts.length} lot(s) cannot be migrated due to active Pending/Sold status.`);
    }
    if (pendingMigration.length > 0) {
      logger.log(`👉 To apply these changes live, run without '--dry-run':`);
      logger.log(`   node scripts/migrate_non_saleable_column.js`);
    } else {
      logger.log(`✅ No eligible lots pending migration.`);
    }

    return {
      isDryRun: true,
      columnExists,
      systemStateTableExists,
      totalParcels: allLots.length,
      candidatesCount: candidateLots.length,
      alreadyFlaggedCount: alreadyFlagged.length,
      pendingMigrationCount: pendingMigration.length,
      statusConflictsCount: statusConflicts.length,
      migrationExcludedCount: migrationExcluded.length,
      affectedRows: 0,
      writeTimeSkipped: 0,
      totalUnresolved: statusConflicts.length,
      completedWithoutConflicts: statusConflicts.length === 0,
    };
  }

  // ==========================================
  // LIVE EXECUTION ONLY BEYOND THIS POINT
  // ==========================================

  // 9. Live Execution: Ensure system_state table exists and persist skip-list
  await ensureSystemStateTable(activeDb);
  await saveSavedExclusions(activeDb, effectiveExcludedIds);
  logger.log(`\n💾 Saved ${effectiveExcludedIds.length} migration skip-list entry/entries in 'system_state' table.`);

  // 10. Live Execution: Add column if missing
  if (!columnExists) {
    logger.log("\n➕ Adding column 'is_non_saleable' TINYINT(1) DEFAULT 0 to 'lots' table...");
    await activeDb.query("ALTER TABLE lots ADD COLUMN is_non_saleable TINYINT(1) DEFAULT 0");
    logger.log("✅ Column 'is_non_saleable' successfully added.");
  }

  // 11. Live Execution: Update ONLY the pending candidate lots by primary key with strict status guard
  let affectedRows = 0;
  const targetLotIds = pendingMigration.map((l) => l.lot_id);

  if (targetLotIds.length > 0) {
    logger.log(`\n🔄 Updating ${targetLotIds.length} pending candidate lot(s) with conditional status guard (status = 'Available')...`);
    
    const [result] = await activeDb.query(
      `UPDATE lots 
       SET is_non_saleable = 1 
       WHERE lot_id IN (?) 
         AND status = 'Available'`,
      [targetLotIds]
    );

    affectedRows = result.affectedRows;
    logger.log(`✅ Updated ${affectedRows} of ${targetLotIds.length} lot(s) to is_non_saleable = 1.`);
  } else {
    logger.log(`\n✅ No pending lots to update.`);
  }

  // 12. Evaluate skipped rows and unresolved conflicts
  const writeTimeSkipped = targetLotIds.length - affectedRows;
  const totalUnresolved = statusConflicts.length + writeTimeSkipped;

  if (writeTimeSkipped > 0) {
    logger.warn(`⚠️ Warning: ${writeTimeSkipped} lot(s) were skipped during update because their status was no longer 'Available' at write time.`);
  }

  // 13. Record migration execution state in system_state
  await activeDb.query(
    `INSERT INTO system_state (state_key, state_value) 
     VALUES ('non_saleable_migration_meta', ?)
     ON DUPLICATE KEY UPDATE state_value = VALUES(state_value)`,
    [
      JSON.stringify({
        executed_at: new Date().toISOString(),
        completed_without_conflicts: totalUnresolved === 0,
        total_parcels: allLots.length,
        candidate_count: candidateLots.length,
        flagged_count: alreadyFlagged.length + affectedRows,
        skipped_exclusions: effectiveExcludedIds,
        preflight_conflicts_count: statusConflicts.length,
        write_time_skipped_count: writeTimeSkipped,
      }),
    ]
  );

  // 14. Verification & Final Stats
  const [finalStats] = await activeDb.query(`
    SELECT 
      COUNT(*) AS total_parcels,
      SUM(CASE WHEN is_non_saleable = 1 THEN 1 ELSE 0 END) AS non_saleable_lots,
      SUM(CASE WHEN is_non_saleable = 0 THEN 1 ELSE 0 END) AS saleable_lots
    FROM lots
  `);

  logger.log("\n📊 [Final Database Status]:", finalStats[0]);

  // 15. Safe Final Completion Status
  if (totalUnresolved > 0) {
    logger.error(`\n⚠️  [MIGRATION INCOMPLETE - UNRESOLVED CONFLICTS]:`);
    logger.error(`   ${totalUnresolved} candidate lot(s) were NOT flagged due to active reservations/sales.`);
    logger.error(`   - Preflight conflicts ('Pending' or 'Sold'): ${statusConflicts.length}`);
    logger.error(`   - Skipped at write-time: ${writeTimeSkipped}`);
    logger.error(`   ❌ Cannot report successful completion until these conflicts are resolved by an administrator.`);
    process.exitCode = 1;
  } else {
    logger.log("\n🎉 Migration process completed successfully with 0 unresolved conflicts.\n");
  }

  return {
    isDryRun: false,
    columnExists: true,
    systemStateTableExists: true,
    totalParcels: allLots.length,
    candidatesCount: candidateLots.length,
    alreadyFlaggedCount: alreadyFlagged.length,
    pendingMigrationCount: pendingMigration.length,
    statusConflictsCount: statusConflicts.length,
    migrationExcludedCount: migrationExcluded.length,
    affectedRows,
    writeTimeSkipped,
    totalUnresolved,
    completedWithoutConflicts: totalUnresolved === 0,
  };
}

module.exports = {
  migrateNonSaleableColumn,
  checkTableExists,
  ensureSystemStateTable,
  loadSavedExclusions,
  saveSavedExclusions,
};

if (require.main === module) {
  migrateNonSaleableColumn()
    .then(async () => {
      await defaultDb.end();
    })
    .catch(async (err) => {
      console.error("❌ Migration error:", err.message);
      await defaultDb.end();
      process.exit(1);
    });
}
