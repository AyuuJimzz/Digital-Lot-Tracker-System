const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const {
  migrateNonSaleableColumn,
  assertMigrationSuccess,
} = require("../scripts/migrate_non_saleable_column");
const { migrateSystemState } = require("../scripts/migrate_system_state");

test("server startup does not import or invoke data-changing migration scripts", () => {
  const serverSource = fs.readFileSync(path.join(__dirname, "../src/server.js"), "utf8");

  // Invariant 1: server.js must not reference auto_migrate
  assert.equal(
    serverSource.includes("auto_migrate"),
    false,
    "server.js must not import auto_migrate"
  );

  // Invariant 2: server.js must not reference individual migration scripts
  const prohibitedMigrations = [
    "migrate_system_state",
    "migrate_lot_status_dates",
    "migrate_login_history",
    "migrate_sale_date_audit",
    "migrate_non_saleable_column",
    "migrate_date_provenance",
    "setup_schema",
  ];
  for (const scriptName of prohibitedMigrations) {
    assert.equal(
      serverSource.includes(scriptName),
      false,
      `server.js must not import or invoke ${scriptName} during startup`
    );
  }

  const stateSource = fs.readFileSync(path.join(__dirname, "../src/services/systemStateStore.js"), "utf8");
  assert.doesNotMatch(stateSource, /\b(?:CREATE|ALTER|DROP)\s+TABLE\b/i,
    "system-state startup must not create or alter schema");
});

test("system_state schema is created only by its explicit migration", async () => {
  const statements = [];
  await migrateSystemState({ db: { query: async (sql) => { statements.push(sql); } } });
  assert.equal(statements.length, 1);
  assert.match(statements[0], /CREATE TABLE IF NOT EXISTS system_state/);
});

test("assertMigrationSuccess throws on unresolved conflicts and refuses to report success", () => {
  // Test with conflict result
  const conflictResult = {
    totalUnresolved: 2,
    statusConflictsCount: 2,
    completedWithoutConflicts: false,
  };
  assert.throws(
    () => assertMigrationSuccess(conflictResult),
    (err) => err.code === "ERR_MIGRATION_CONFLICT"
  );

  // Test with null/undefined result
  assert.throws(
    () => assertMigrationSuccess(null),
    (err) => err.code === "ERR_MIGRATION_CONFLICT"
  );

  // Test with successful clean result
  const cleanResult = {
    totalUnresolved: 0,
    statusConflictsCount: 0,
    completedWithoutConflicts: true,
  };
  assert.equal(assertMigrationSuccess(cleanResult), cleanResult);
});

test("non-saleable preview reports conflicts and live migration rejects before writes", async () => {
  // Database-free mock: simulate candidate lots with a status conflict
  const statements = [];
  const mockDb = {
    async query(sql) {
      const sqlString = typeof sql === "string" ? sql : "";
      statements.push(sqlString);
      if (sqlString.includes("information_schema.TABLES")) {
        return [[{ TABLE_NAME: "system_state" }]];
      }
      if (sqlString.includes("SELECT state_value FROM system_state")) {
        return [[]];
      }
      if (sqlString.includes("information_schema.COLUMNS")) {
        return [[{ COLUMN_NAME: "is_non_saleable" }]];
      }
      if (sqlString.includes("SELECT") && sqlString.includes("lot_id")) {
        // Return 1 candidate lot with conflict status 'Pending'
        return [[
          {
            lot_id: 1,
            property_id: 1,
            lot_number: "Park 1",
            status: "Pending",
            is_non_saleable: 0,
          },
        ]];
      }
      return [[]];
    },
  };

  const silentLogger = { log: () => {}, warn: () => {}, error: () => {}, table: () => {} };

  // When throwOnConflict is enabled, it must reject with ERR_MIGRATION_CONFLICT
  await assert.rejects(
    async () => {
      await migrateNonSaleableColumn({
        db: mockDb,
        isDryRun: true,
        logger: silentLogger,
        throwOnConflict: true,
      });
    },
    (err) => {
      assert.equal(err.code, "ERR_MIGRATION_CONFLICT");
      assert.equal(err.unresolvedCount, 1);
      return true;
    }
  );

  // Without throwOnConflict, it must return completedWithoutConflicts === false (never true)
  const result = await migrateNonSaleableColumn({
    db: mockDb,
    isDryRun: true,
    logger: silentLogger,
  });
  assert.equal(result.completedWithoutConflicts, false);
  assert.equal(result.totalUnresolved, 1);

  // Live callers fail by default, before any DDL or DML can occur.
  await assert.rejects(
    migrateNonSaleableColumn({ db: mockDb, isDryRun: false, logger: silentLogger }),
    (err) => err.code === "ERR_MIGRATION_CONFLICT" && err.unresolvedCount === 1
  );
  assert.equal(statements.some((sql) => /\b(?:CREATE|ALTER|UPDATE|INSERT|DELETE)\b/i.test(sql)), false);
});

test("non-saleable live migration rejects a write-time status conflict with its result", async () => {
  const mockDb = {
    async query(sql) {
      if (sql.includes("information_schema.TABLES")) return [[{ TABLE_NAME: "system_state" }]];
      if (sql.includes("SELECT state_value FROM system_state")) return [[]];
      if (sql.includes("information_schema.COLUMNS")) return [[{ COLUMN_NAME: "is_non_saleable" }]];
      if (sql.includes("ORDER BY property_id, lot_number")) {
        return [[{ lot_id: 1, property_id: 1, lot_number: "Park 1", status: "Available", is_non_saleable: 0 }]];
      }
      if (sql.includes("UPDATE lots")) return [{ affectedRows: 0 }];
      if (sql.includes("COUNT(*) AS total_parcels")) {
        return [[{ total_parcels: 1, non_saleable_lots: 0, saleable_lots: 1 }]];
      }
      return [[]];
    },
  };
  const silentLogger = { log: () => {}, warn: () => {}, error: () => {}, table: () => {} };
  await assert.rejects(
    migrateNonSaleableColumn({ db: mockDb, isDryRun: false, logger: silentLogger }),
    (err) => err.code === "ERR_MIGRATION_CONFLICT" && err.result?.writeTimeSkipped === 1 &&
      err.result?.completedWithoutConflicts === false
  );
});
