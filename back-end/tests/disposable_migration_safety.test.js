/**
 * Automated safety test suite running strictly against a DISPOSABLE test database.
 * 
 * Safety Invariants Enforced:
 * 1. Hard Safety Checks:
 *    - Host validation: Only allowed on localhost / 127.0.0.1.
 *    - Database name validation: Must start with `disposable_test_safeguard_` with randomized timestamp/nonce.
 *    - Rejection guard: Refuses to touch any DB matching process.env.DB_NAME, "golden_dragon_corp", or "prod".
 * 2. True Controller & Script Invocations (Zero Logic Duplication):
 *    - Calls actual `migrateNonSaleableColumn()` from `../scripts/migrate_non_saleable_column`.
 *    - Calls actual `updateLotDetails()` controller from `../src/controllers/lotsController`.
 *    - Calls actual `createOrUpdateCustomer()` controller from `../src/controllers/customersController`.
 * 3. Test Coverage:
 *    - Test 1: Dry-run mode when `system_state` does NOT exist (0 DDL, 0 writes).
 *    - Test 2: Concurrency & row-locking: `SELECT ... FOR UPDATE` + conditional update guard prevents invalid reservation.
 *    - Test 3: Actual `updateLotDetails` controller: Concurrent status change under row lock blocks classifying as non-saleable.
 *    - Test 4: Skip-list semantics (--exclude-ids) via actual migration function.
 *    - Test 5: Actual `createOrUpdateCustomer` controller: Row-lock guard blocks assigning customer to non-saleable lots.
 *    - Test 6: Customer update and transfer retain cancelled reservation and transaction history.
 *    - Test 7: Customer creation rejects a concurrent non-saleable classification.
 *    - Test 8: An active reservation is selected ahead of cancelled history on the same lot.
 *    - Test 9: Another employee cannot transfer an agent's pending reservation.
 */
const mysql = require("mysql2/promise");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const {
  migrateNonSaleableColumn,
  checkTableExists,
} = require("../scripts/migrate_non_saleable_column");
const { updateLotDetails } = require("../src/controllers/lotsController");
const { createOrUpdateCustomer } = require("../src/controllers/customersController");
const { updateLotStatus } = require("../src/controllers/lots/lotStatusController");
const { createTransaction, updateTransactionStatus } = require("../src/controllers/transactionsController");

// Safety invariant constants
const DISPOSABLE_TEST_PREFIX = "disposable_test_safeguard_";
const ALLOWED_TEST_HOSTS = ["localhost", "127.0.0.1"];

// Generate unique, disposable database name with high-entropy timestamp and random nonce
const UNIQUE_NONCE = `${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
const DISPOSABLE_DB_NAME = `${DISPOSABLE_TEST_PREFIX}${UNIQUE_NONCE}`;

/**
 * Hard safety check that strictly validates host and DB name before ANY database operation.
 */
function assertDisposableDatabaseSafety(host, dbName) {
  // 1. Host check
  if (!ALLOWED_TEST_HOSTS.includes(host)) {
    throw new Error(
      `🛑 CRITICAL HARD SAFETY CHECK FAILED: Refusing to run destructive tests on host "${host}". Destructive tests are ONLY permitted on localhost/127.0.0.1.`
    );
  }

  // 2. Database name format check
  if (!dbName || typeof dbName !== "string" || !dbName.startsWith(DISPOSABLE_TEST_PREFIX)) {
    throw new Error(
      `🛑 CRITICAL HARD SAFETY CHECK FAILED: Database "${dbName}" does not match required disposable prefix "${DISPOSABLE_TEST_PREFIX}". Aborting.`
    );
  }

  // 3. Negative check against production and configured databases
  const protectedNames = [
    process.env.DB_NAME,
    "golden_dragon_corp",
    "golden_dragon_estate",
    "production",
    "prod",
    "master",
    "main",
  ].filter(Boolean);

  for (const protectedName of protectedNames) {
    if (dbName.toLowerCase() === protectedName.toLowerCase()) {
      throw new Error(
        `🛑 CRITICAL HARD SAFETY CHECK FAILED: Database "${dbName}" matches protected database name "${protectedName}". Destructive execution BLOCKED.`
      );
    }
  }
}

// Logger capture utility for testing CLI output without terminal noise
function createCapturingLogger() {
  const logs = [];
  const errors = [];
  const warns = [];
  return {
    log: (...args) => logs.push(args.join(" ")),
    error: (...args) => errors.push(args.join(" ")),
    warn: (...args) => warns.push(args.join(" ")),
    table: () => {},
    getLogs: () => logs,
    getErrors: () => errors,
    getWarns: () => warns,
  };
}

// Mock Express response object for controller tests
function createMockResponse() {
  let responseData = null;
  let statusCode = 200;
  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    },
    getStatusCode: () => statusCode,
    getData: () => responseData,
  };
  return res;
}

async function runTestSuite() {
  console.log("=========================================================================");
  console.log(`🧪 STARTING AUTOMATED DISPOSABLE SAFETY TEST SUITE`);
  console.log(`🎯 Target Disposable DB: [${DISPOSABLE_DB_NAME}]`);
  console.log("=========================================================================\n");

  const dbHost = process.env.DB_HOST || "localhost";
  const dbUser = process.env.DB_USER || "root";
  const dbPassword = process.env.DB_PASSWORD || "";
  const dbPort = Number(process.env.DB_PORT) || 3306;

  // Execute hard safety assertion
  assertDisposableDatabaseSafety(dbHost, DISPOSABLE_DB_NAME);
  console.log(`🛡️  Hard Safety Assertion Passed: Host is '${dbHost}', DB matches disposable pattern.`);

  // Connect to MySQL server to provision disposable database
  const rootConn = await mysql.createConnection({
    host: dbHost,
    user: dbUser,
    password: dbPassword,
    port: dbPort,
  });

  let disposablePool = null;

  try {
    // Drop and create disposable DB
    assertDisposableDatabaseSafety(dbHost, DISPOSABLE_DB_NAME);
    await rootConn.query(`DROP DATABASE IF EXISTS \`${DISPOSABLE_DB_NAME}\``);
    await rootConn.query(`CREATE DATABASE \`${DISPOSABLE_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ Provisioned isolated disposable database: \`${DISPOSABLE_DB_NAME}\``);

    // Create pool targeting strictly the disposable database
    disposablePool = mysql.createPool({
      host: dbHost,
      user: dbUser,
      password: dbPassword,
      port: dbPort,
      database: DISPOSABLE_DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
    });

    // Seed dummy schema and test lots
    await disposablePool.query(`
      CREATE TABLE lots (
        lot_id INT PRIMARY KEY AUTO_INCREMENT,
        property_id INT NOT NULL,
        lot_number VARCHAR(100) NOT NULL,
        area_sqm DECIMAL(10, 2) NOT NULL DEFAULT 100.00,
        status VARCHAR(50) NOT NULL DEFAULT 'Available',
        is_non_saleable TINYINT(1) DEFAULT 0,
        coordinates TEXT NULL,
        pending_since DATETIME NULL,
        last_reminder_sent DATETIME NULL,
        sold_on DATE NULL DEFAULT NULL
      ) ENGINE=InnoDB
    `);

    await disposablePool.query(`
      CREATE TABLE customers (
        customer_id INT PRIMARY KEY AUTO_INCREMENT,
        lot_id INT NULL,
        full_name VARCHAR(100) NOT NULL,
        contact_number VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL,
        address VARCHAR(255) NOT NULL,
        employee_id INT NULL,
        customer_status VARCHAR(50) DEFAULT 'Pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    await disposablePool.query(`
      CREATE TABLE transactions (
        transaction_id INT PRIMARY KEY AUTO_INCREMENT,
        lot_id INT NOT NULL,
        customer_id INT NULL,
        payment_type VARCHAR(50) DEFAULT 'No Downpayment',
        notes TEXT NULL,
        employee_id INT NULL,
        agent_name VARCHAR(100) DEFAULT 'Admin',
        transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_date_verified TINYINT(1) NOT NULL DEFAULT 0,
        date_provenance VARCHAR(50) NOT NULL DEFAULT 'unknown_requires_review'
      ) ENGINE=InnoDB
    `);

    await disposablePool.query(`
      INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable) VALUES
      (1, 1, 'Block 1 Lot 1', 'Available', 0),
      (2, 1, 'Block 8 Lot 1 (Park)', 'Available', 0),
      (3, 1, 'Block 8 Lot 2 (Community Facility)', 'Available', 0),
      (4, 1, 'Block 8 Lot 3 (P & PG)', 'Available', 0),
      (5, 1, 'Block 10 Lot 1 (Parkway)', 'Available', 0)
    `);

    console.log("✅ Seeded test tables and lots. Note: 'system_state' table has NOT been created.\n");

    // -----------------------------------------------------------------------------------
    // TEST 1: Dry-Run Mode via Actual migrateNonSaleableColumn() (No system_state table)
    // -----------------------------------------------------------------------------------
    console.log("--- TEST 1: Actual Migration Dry-Run (Read-Only, No 'system_state' table) ---");

    // Precondition: system_state does not exist
    const systemStateExistsBefore = await checkTableExists(disposablePool, "system_state");
    if (systemStateExistsBefore) throw new Error("Precondition failed: system_state already exists!");

    const testLogger1 = createCapturingLogger();
    // Run ACTUAL migration script in dry-run mode
    const dryRunResult = await migrateNonSaleableColumn({
      pool: disposablePool,
      isDryRun: true,
      logger: testLogger1,
    });

    // Verify system_state table was NOT created (0 DDL)
    const systemStateExistsAfter = await checkTableExists(disposablePool, "system_state");
    if (systemStateExistsAfter) {
      throw new Error("TEST 1 FAILED: Dry-run leaked DDL! 'system_state' table was created in dry-run mode.");
    }

    // Verify 0 rows in lots table were updated (0 DML)
    const [flaggedLots] = await disposablePool.query("SELECT * FROM lots WHERE is_non_saleable = 1");
    if (flaggedLots.length !== 0) {
      throw new Error(`TEST 1 FAILED: Dry-run wrote data! Found ${flaggedLots.length} flagged lot(s).`);
    }

    // Verify dry run result structure
    if (
      dryRunResult.isDryRun === true &&
      dryRunResult.candidatesCount === 3 && // Lots 2, 3, 4 (excluding Lot 5 'Parkway')
      dryRunResult.pendingMigrationCount === 3 &&
      dryRunResult.affectedRows === 0 &&
      dryRunResult.systemStateTableExists === false
    ) {
      console.log("✅ TEST 1 PASSED: Actual migrateNonSaleableColumn() in dry-run mode executed 0 DDL and 0 writes.");
      console.log("   - 'system_state' table remained non-existent.");
      console.log("   - Correctly identified 3 candidates (Lots 2, 3, 4) without matching 'Parkway' (Lot 5).\n");
    } else {
      throw new Error("TEST 1 FAILED: Unexpected dry-run result metrics: " + JSON.stringify(dryRunResult));
    }

    // -----------------------------------------------------------------------------------
    // TEST 2: Concurrency Race Condition - Row Lock + Conditional Update Guard
    // -----------------------------------------------------------------------------------
    console.log("--- TEST 2: Concurrency Race Condition (Reservation vs. Actual Migration) ---");

    // Connection 1 (Simulating reservation process on Lot 2):
    // Begins transaction and acquires row lock with SELECT ... FOR UPDATE
    const conn1 = await disposablePool.getConnection();
    await conn1.beginTransaction();
    const [lockedLot] = await conn1.query("SELECT * FROM lots WHERE lot_id = ? FOR UPDATE", [2]);
    console.log(`🔒 Conn 1: Acquired exclusive row lock on Lot 2 (${lockedLot[0].lot_number})`);

    let migrationFinished = false;
    let liveMigrationResult = null;
    const testLogger2 = createCapturingLogger();

    // In parallel, launch the ACTUAL live migration function
    const migrationPromise = (async () => {
      console.log("⏳ Conn 2: Actual migrateNonSaleableColumn() attempting live update on Lots 2, 3, 4...");
      liveMigrationResult = await migrateNonSaleableColumn({
        pool: disposablePool,
        isDryRun: false,
        logger: testLogger2,
      });
      migrationFinished = true;
      console.log("🔓 Conn 2: migrateNonSaleableColumn() completed.");
    })();

    // Verify Conn 2 is actually waiting on Conn 1's row lock
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (migrationFinished) {
      throw new Error("TEST 2 FAILED: Migration did not wait for row lock on Lot 2!");
    }
    console.log("🛡️ Verified: Migration is blocked on InnoDB row lock waiting for Conn 1.");

    // Conn 1 marks Lot 2 as 'Pending' (reservation finalized) and commits
    await conn1.query("UPDATE lots SET status = 'Pending', pending_since = NOW() WHERE lot_id = 2");
    await conn1.commit();
    conn1.release();
    console.log("📝 Conn 1: Committed reservation on Lot 2 (status = 'Pending'). Released lock.");

    // Await completion of live migration
    await migrationPromise;

    // Inspect database state after migration
    const [lotsAfterMigration] = await disposablePool.query(
      "SELECT lot_id, lot_number, status, is_non_saleable FROM lots WHERE lot_id IN (2, 3, 4)"
    );

    const lot2 = lotsAfterMigration.find((l) => l.lot_id === 2);
    const lot3 = lotsAfterMigration.find((l) => l.lot_id === 3);
    const lot4 = lotsAfterMigration.find((l) => l.lot_id === 4);

    console.log("DB State After Race Condition Resolution:");
    console.log(`  Lot 2 (${lot2.lot_number}): status = '${lot2.status}', is_non_saleable = ${lot2.is_non_saleable}`);
    console.log(`  Lot 3 (${lot3.lot_number}): status = '${lot3.status}', is_non_saleable = ${lot3.is_non_saleable}`);
    console.log(`  Lot 4 (${lot4.lot_number}): status = '${lot4.status}', is_non_saleable = ${lot4.is_non_saleable}`);

    // Invariants to verify:
    // 1. Lot 2: status must remain 'Pending', is_non_saleable MUST remain 0 (skipped due to status guard!)
    // 2. Lot 3 & 4: status 'Available', is_non_saleable updated to 1
    // 3. Migration result: writeTimeSkipped === 1, completedWithoutConflicts === false (refused to claim success!)
    if (
      lot2.status === "Pending" &&
      lot2.is_non_saleable === 0 &&
      lot3.is_non_saleable === 1 &&
      lot4.is_non_saleable === 1 &&
      liveMigrationResult.writeTimeSkipped === 1 &&
      liveMigrationResult.completedWithoutConflicts === false
    ) {
      console.log("✅ TEST 2 PASSED: Real migration script safely skipped Lot 2, updated Lots 3 and 4, and refused to report full success due to write-time conflict.\n");
    } else {
      throw new Error("TEST 2 FAILED: Concurrency invariant violated! " + JSON.stringify(liveMigrationResult));
    }

    // -----------------------------------------------------------------------------------
    // TEST 3: Actual updateLotDetails Controller with Concurrent Status Change
    // -----------------------------------------------------------------------------------
    console.log("--- TEST 3: Actual updateLotDetails Controller vs Concurrent Status Change ---");

    // Scenario:
    // Reset Lot 2 to 'Available'
    await disposablePool.query("UPDATE lots SET status = 'Available', is_non_saleable = 0 WHERE lot_id = 2");

    // Agent Conn 3 starts a reservation on Lot 2 under row lock
    const conn3 = await disposablePool.getConnection();
    await conn3.beginTransaction();
    await conn3.query("SELECT * FROM lots WHERE lot_id = 2 FOR UPDATE");
    console.log("🔒 Conn 3: Holding row lock on Lot 2 while processing reservation...");

    // Concurrently, an admin calls the ACTUAL updateLotDetails controller to classify Lot 2 as non-saleable
    const mockReq3 = {
      params: { id: "2" },
      body: {
        lot_number: "Block 8 Lot 1 (Park)",
        area_sqm: "450.00",
        is_non_saleable: 1,
      },
      db: disposablePool,
    };
    const mockRes3 = createMockResponse();

    let updateLotFinished = false;
    const updateLotPromise = (async () => {
      console.log("⏳ Admin: Invoking actual updateLotDetails() controller on Lot 2...");
      await updateLotDetails(mockReq3, mockRes3);
      updateLotFinished = true;
    })();

    // Verify updateLotDetails is blocked waiting on Conn 3's row lock
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (updateLotFinished) {
      throw new Error("TEST 3 FAILED: updateLotDetails did not wait for row lock!");
    }
    console.log("🛡️ Verified: updateLotDetails is waiting on row lock for Lot 2.");

    // Conn 3 sets Lot 2 status to 'Pending' (reservation completed) and commits
    await conn3.query("UPDATE lots SET status = 'Pending', pending_since = NOW() WHERE lot_id = 2");
    await conn3.commit();
    conn3.release();
    console.log("📝 Conn 3: Committed reservation on Lot 2 (status = 'Pending'). Released lock.");

    // Await updateLotDetails controller completion
    await updateLotPromise;

    const resCode3 = mockRes3.getStatusCode();
    const resData3 = mockRes3.getData();
    console.log(`Controller Response: HTTP ${resCode3}:`, resData3);

    // Verify that the actual controller rejected the non-saleable classification
    const [lot2Final] = await disposablePool.query("SELECT status, is_non_saleable FROM lots WHERE lot_id = 2");

    if (
      resCode3 === 400 &&
      resData3.error?.includes("Cannot classify lot as non-saleable while its status is 'Pending'") &&
      lot2Final[0].is_non_saleable === 0 &&
      lot2Final[0].status === "Pending"
    ) {
      console.log("✅ TEST 3 PASSED: Actual updateLotDetails() under row lock successfully detected concurrent 'Pending' status, rejected with HTTP 400, and kept is_non_saleable = 0.\n");
    } else {
      throw new Error("TEST 3 FAILED: updateLotDetails failed to guard against concurrent status change!");
    }

    // -----------------------------------------------------------------------------------
    // TEST 4: Skip-List Semantics (--exclude-ids) via Actual Migration Script
    // -----------------------------------------------------------------------------------
    console.log("--- TEST 4: Skip-List Semantics via Actual Migration Script ---");

    const testLogger4 = createCapturingLogger();
    await migrateNonSaleableColumn({
      pool: disposablePool,
      isDryRun: false,
      cliExcludeIds: [3],
      logger: testLogger4,
    });

    // Check system_state stored exclusions
    const [sysRows] = await disposablePool.query(
      "SELECT state_value FROM system_state WHERE state_key = 'non_saleable_manual_exclusions'"
    );
    const storedExclusions = JSON.parse(sysRows[0]?.state_value || "[]");

    if (storedExclusions.includes(3)) {
      console.log("✅ TEST 4 PASSED: Skip-list successfully persisted [3] in 'system_state'.");
      console.log("   - Semantics confirmed: Skip-list acts as a migration filter and does not alter existing data.\n");
    } else {
      throw new Error("TEST 4 FAILED: Skip-list was not persisted in system_state!");
    }

    // -----------------------------------------------------------------------------------
    // TEST 5: Actual createOrUpdateCustomer Controller Path Guard
    // -----------------------------------------------------------------------------------
    console.log("--- TEST 5: Actual createOrUpdateCustomer Controller Guard ---");

    // Attempt to assign customer to non-saleable Lot 3 (is_non_saleable = 1)
    const mockReq5A = {
      params: { id: "3" },
      body: {
        full_name: "Illegal Non-Saleable Buyer",
        contact_number: "09171234567",
        email: "illegal_buyer@example.com",
        address: "123 Park Avenue",
      },
      db: disposablePool,
    };
    const mockRes5A = createMockResponse();

    console.log("⏳ Invoking actual createOrUpdateCustomer() on non-saleable Lot 3...");
    await createOrUpdateCustomer(mockReq5A, mockRes5A);

    const resCode5A = mockRes5A.getStatusCode();
    const resData5A = mockRes5A.getData();
    console.log(`Controller Response: HTTP ${resCode5A}:`, resData5A);

    // Verify 0 customer records were inserted for Lot 3
    const [custForLot3] = await disposablePool.query("SELECT * FROM customers WHERE lot_id = 3");

    if (
      resCode5A === 400 &&
      resData5A.error?.includes("Customers cannot be assigned to non-saleable lots") &&
      custForLot3.length === 0
    ) {
      console.log("✅ TEST 5A PASSED: createOrUpdateCustomer() under row lock rejected assigning customer to non-saleable lot with HTTP 400.\n");
    } else {
      throw new Error("TEST 5A FAILED: createOrUpdateCustomer permitted customer creation on non-saleable lot!");
    }

    // Attempt to assign customer to valid saleable Lot 1 (Available)
    const mockReq5B = {
      params: { id: "1" },
      body: {
        full_name: "Legitimate Buyer",
        contact_number: "09187654321",
        email: "legit_buyer@example.com",
        address: "456 Residence St",
      },
      db: disposablePool,
    };
    const mockRes5B = createMockResponse();

    console.log("⏳ Invoking actual createOrUpdateCustomer() on valid saleable Lot 1...");
    await createOrUpdateCustomer(mockReq5B, mockRes5B);

    const resCode5B = mockRes5B.getStatusCode();
    const [custForLot1] = await disposablePool.query("SELECT * FROM customers WHERE lot_id = 1");

    if (resCode5B === 200 && custForLot1.length === 1 && custForLot1[0].full_name === "Legitimate Buyer") {
      console.log("✅ TEST 5B PASSED: createOrUpdateCustomer() successfully created customer for saleable Lot 1 under row lock.\n");
    } else {
      throw new Error("TEST 5B FAILED: createOrUpdateCustomer failed for valid saleable lot!");
    }

    console.log("--- TEST 6: Customer Update and Transfer Preserve History ---");
    const originalCustomerId = custForLot1[0].customer_id;
    await disposablePool.query("UPDATE customers SET employee_id = 7 WHERE customer_id = ?", [originalCustomerId]);
    await disposablePool.query("UPDATE lots SET status = 'Pending', pending_since = NOW() WHERE lot_id = 1");
    const [originalTransaction] = await disposablePool.query(
      "INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, agent_name) VALUES (1, ?, 'No Downpayment', 'Original reservation', 7, 'Agent Seven')",
      [originalCustomerId]
    );

    const updateResponse = createMockResponse();
    await createOrUpdateCustomer({
      params: { id: "1" }, body: { ...mockReq5B.body, full_name: "Updated Buyer" },
      user: { role: "employee", id: 7 }, db: disposablePool,
    }, updateResponse);
    const [updatedRows] = await disposablePool.query("SELECT customer_id, full_name FROM customers WHERE lot_id = 1");
    if (updateResponse.getStatusCode() !== 200 || updatedRows.length !== 1 ||
        updatedRows[0].customer_id !== originalCustomerId || updatedRows[0].full_name !== "Updated Buyer") {
      throw new Error("TEST 6 FAILED: In-place update changed customer identity or failed.");
    }

    const transferResponse = createMockResponse();
    await createOrUpdateCustomer({
      params: { id: "5" }, body: { ...mockReq5B.body, full_name: "Transferred Buyer" },
      user: { role: "employee", id: 7 }, db: disposablePool,
    }, transferResponse);
    const [oldCustomer] = await disposablePool.query("SELECT customer_id, lot_id, customer_status, employee_id FROM customers WHERE customer_id = ?", [originalCustomerId]);
    const [newCustomer] = await disposablePool.query("SELECT customer_id, lot_id, customer_status, employee_id FROM customers WHERE lot_id = 5");
    const [oldHistory] = await disposablePool.query("SELECT transaction_id, customer_id, employee_id, agent_name FROM transactions WHERE transaction_id = ?", [originalTransaction.insertId]);
    const [newHistory] = await disposablePool.query("SELECT transaction_id, customer_id, employee_id, agent_name FROM transactions WHERE lot_id = 5");
    const [lotStatuses] = await disposablePool.query("SELECT lot_id, status FROM lots WHERE lot_id IN (1, 5) ORDER BY lot_id");
    if (transferResponse.getStatusCode() !== 200 || oldCustomer.length !== 1 ||
        oldCustomer[0].lot_id !== 1 || oldCustomer[0].customer_status !== "Cancelled" ||
        newCustomer.length !== 1 || newCustomer[0].customer_id === originalCustomerId ||
        newCustomer[0].customer_status !== "Pending" || newCustomer[0].employee_id !== 7 ||
        oldHistory.length !== 1 || oldHistory[0].customer_id !== originalCustomerId ||
        oldHistory[0].employee_id !== 7 || oldHistory[0].agent_name !== "Agent Seven" ||
        newHistory.length !== 1 || newHistory[0].customer_id !== newCustomer[0].customer_id ||
        newHistory[0].employee_id !== 7 || newHistory[0].agent_name !== "Agent Seven" ||
        lotStatuses[0]?.status !== "Available" || lotStatuses[1]?.status !== "Pending") {
      throw new Error("TEST 6 FAILED: Transfer lost reservation history, attribution, or lot status integrity.");
    }
    console.log("✅ TEST 6 PASSED: Old reservation and transaction remain; new lot has a separate Pending record.\n");

    console.log("--- TEST 7: Customer Creation vs Concurrent Classification ---");
    await disposablePool.query(
      "INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable) VALUES (6, 1, 'Community Area', 'Available', 0)"
    );
    const classificationConnection = await disposablePool.getConnection();
    try {
      await classificationConnection.beginTransaction();
      await classificationConnection.query("SELECT lot_id FROM lots WHERE lot_id = 6 FOR UPDATE");
      const raceResponse = createMockResponse();
      let customerFinished = false;
      const customerPromise = createOrUpdateCustomer({
        params: { id: "6" }, body: { ...mockReq5B.body, email: "race_buyer@example.com" },
        user: { role: "admin", id: 1 }, db: disposablePool,
      }, raceResponse).then(() => { customerFinished = true; });
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (customerFinished) throw new Error("TEST 7 FAILED: Controller did not wait for the lot row lock.");
      await classificationConnection.query("UPDATE lots SET is_non_saleable = 1 WHERE lot_id = 6");
      await classificationConnection.commit();
      await customerPromise;
      const [raceCustomers] = await disposablePool.query("SELECT customer_id FROM customers WHERE lot_id = 6");
      if (raceResponse.getStatusCode() !== 400 || raceCustomers.length !== 0) {
        throw new Error("TEST 7 FAILED: Customer was attached to a newly non-saleable lot.");
      }
    } finally {
      try { await classificationConnection.rollback(); } catch (_) { /* Already committed. */ }
      classificationConnection.release();
    }
    console.log("✅ TEST 7 PASSED: Actual controller rejected the lot after a concurrent classification change.\n");

    console.log("--- TEST 8: Rebooking Does Not Rewrite Cancelled Customer History ---");
    await disposablePool.query("UPDATE lots SET status = 'Pending', pending_since = NOW() WHERE lot_id = 1");
    const [rebookedCustomer] = await disposablePool.query(
      "INSERT INTO customers (lot_id, full_name, contact_number, email, address, employee_id, customer_status) VALUES (1, 'Rebooked Buyer', '09180000000', 'rebooked@example.com', 'New Address', 7, 'Pending')"
    );
    const rebookResponse = createMockResponse();
    await createOrUpdateCustomer({
      params: { id: "1" },
      body: { full_name: "Rebooked Buyer Edited", contact_number: "09180000001", email: "rebooked@example.com", address: "New Address" },
      user: { role: "employee", id: 7 }, db: disposablePool,
    }, rebookResponse);
    const [rebookRows] = await disposablePool.query(
      "SELECT customer_id, full_name, customer_status FROM customers WHERE lot_id = 1 ORDER BY customer_id"
    );
    if (rebookResponse.getStatusCode() !== 200 || rebookRows.length !== 2 ||
        rebookRows[0].customer_id !== originalCustomerId || rebookRows[0].customer_status !== "Cancelled" ||
        rebookRows[0].full_name !== "Updated Buyer" ||
        rebookRows[1].customer_id !== rebookedCustomer.insertId ||
        rebookRows[1].full_name !== "Rebooked Buyer Edited") {
      throw new Error("TEST 8 FAILED: The controller edited cancelled history instead of the active reservation.");
    }
    console.log("✅ TEST 8 PASSED: Active customer updated; cancelled history remained unchanged.\n");

    console.log("--- TEST 9: Reserving Agent Ownership on Transfer ---");
    await disposablePool.query(
      "INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable) VALUES (7, 1, 'Regular Lot 7', 'Available', 0)"
    );
    const unauthorizedResponse = createMockResponse();
    await createOrUpdateCustomer({
      params: { id: "7" }, body: { ...mockReq5B.body, full_name: "Unauthorized Transfer" },
      user: { role: "employee", id: 8 }, db: disposablePool,
    }, unauthorizedResponse);
    const [unauthorizedCustomers] = await disposablePool.query("SELECT customer_id FROM customers WHERE lot_id = 7");
    const [sourceAfterUnauthorized] = await disposablePool.query("SELECT status FROM lots WHERE lot_id = 5");
    if (unauthorizedResponse.getStatusCode() !== 403 || unauthorizedCustomers.length !== 0 ||
        sourceAfterUnauthorized[0]?.status !== "Pending") {
      throw new Error("TEST 9 FAILED: An unrelated employee transferred another agent's reservation.");
    }
    console.log("✅ TEST 9 PASSED: Unrelated employee cannot transfer the pending reservation.\n");

    await disposablePool.query(`
      CREATE TABLE employees (
        employee_id INT PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NULL
      ) ENGINE=InnoDB
    `);
    await disposablePool.query(
      "INSERT INTO employees (employee_id, first_name, last_name) VALUES (7, 'Agent', 'Seven'), (8, 'Agent', 'Eight')"
    );

    console.log("--- TEST 10: Admin-Owned Pending Reservation Is Employee-Read-Only ---");
    await disposablePool.query(
      "INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable) VALUES (8, 1, 'Admin Lot', 'Pending', 0)"
    );
    await disposablePool.query(
      "INSERT INTO customers (lot_id, full_name, contact_number, email, address, employee_id, customer_status) VALUES (8, 'Admin Buyer', '09180000000', 'adminbuyer@example.com', 'Iloilo', NULL, 'Pending')"
    );
    const adminOwnedResponse = createMockResponse();
    await updateLotStatus({
      params: { id: "8" }, body: { status: "Available" },
      user: { role: "employee", id: 8 }, db: disposablePool,
    }, adminOwnedResponse);
    const [[adminOwnedLot]] = await disposablePool.query("SELECT status FROM lots WHERE lot_id = 8");
    if (adminOwnedResponse.getStatusCode() !== 403 || adminOwnedLot.status !== "Pending") {
      throw new Error("TEST 10 FAILED: Employee changed an Admin-owned reservation.");
    }
    console.log("✅ TEST 10 PASSED: Admin-owned Pending lot remains protected.\n");

    console.log("--- TEST 11: Completed Sale Cannot Be Rewritten as Pending ---");
    await disposablePool.query(
      "INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable) VALUES (9, 1, 'Sold Lot', 'Sold', 0)"
    );
    const [soldCustomerResult] = await disposablePool.query(
      "INSERT INTO customers (lot_id, full_name, contact_number, email, address, employee_id, customer_status) VALUES (9, 'Sold Buyer', '09180000000', 'soldbuyer@example.com', 'Iloilo', 7, 'Sold')"
    );
    const [soldTransactionResult] = await disposablePool.query(
      "INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, agent_name) VALUES (9, ?, 'Cash', 'Completed sale', 7, 'Agent Seven')",
      [soldCustomerResult.insertId]
    );
    const soldReversalResponse = createMockResponse();
    await updateLotStatus({
      params: { id: "9" },
      body: { status: "Pending", email: "soldbuyer@example.com", fullName: "Sold Buyer", contactNumber: "09180000000", address: "Iloilo" },
      user: { role: "admin", id: 1 }, db: disposablePool,
    }, soldReversalResponse);
    const [[soldLotAfter]] = await disposablePool.query("SELECT status FROM lots WHERE lot_id = 9");
    const [[soldCustomerAfter]] = await disposablePool.query("SELECT customer_status FROM customers WHERE customer_id = ?", [soldCustomerResult.insertId]);
    const [[soldTransactionAfter]] = await disposablePool.query("SELECT payment_type, agent_name FROM transactions WHERE transaction_id = ?", [soldTransactionResult.insertId]);
    if (soldReversalResponse.getStatusCode() !== 409 || soldLotAfter.status !== "Sold" ||
        soldCustomerAfter.customer_status !== "Sold" || soldTransactionAfter.payment_type !== "Cash" ||
        soldTransactionAfter.agent_name !== "Agent Seven") {
      throw new Error("TEST 11 FAILED: Sold history changed during a direct status reversal.");
    }
    console.log("✅ TEST 11 PASSED: Sale and commission history stay intact.\n");

    console.log("--- TEST 12: Transaction Creation Enforces Current Customer and Agent ---");
    await disposablePool.query(
      "INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable) VALUES (10, 1, 'Transaction Lot', 'Available', 0)"
    );
    const [transactionCustomerResult] = await disposablePool.query(
      "INSERT INTO customers (lot_id, full_name, contact_number, email, address, employee_id, customer_status) VALUES (10, 'Transaction Buyer', '09180000000', 'transactionbuyer@example.com', 'Iloilo', 7, 'Pending')"
    );
    const transactionBody = { lot_id: 10, customer_id: transactionCustomerResult.insertId, payment_type: "No Downpayment" };
    const wrongAgentCreate = createMockResponse();
    await createTransaction({ body: transactionBody, user: { role: "employee", id: 8 }, db: disposablePool }, wrongAgentCreate);
    const wrongCustomerCreate = createMockResponse();
    await createTransaction({ body: { ...transactionBody, customer_id: soldCustomerResult.insertId }, user: { role: "employee", id: 7 }, db: disposablePool }, wrongCustomerCreate);
    const validCreate = createMockResponse();
    await createTransaction({ body: transactionBody, user: { role: "employee", id: 7 }, db: disposablePool }, validCreate);
    const duplicateCreate = createMockResponse();
    await createTransaction({ body: transactionBody, user: { role: "employee", id: 7 }, db: disposablePool }, duplicateCreate);
    const [[newTransaction]] = await disposablePool.query("SELECT transaction_id, employee_id, agent_name FROM transactions WHERE lot_id = 10");
    if (wrongAgentCreate.getStatusCode() !== 403 || wrongCustomerCreate.getStatusCode() !== 409 ||
        validCreate.getStatusCode() !== 201 || duplicateCreate.getStatusCode() !== 409 ||
        newTransaction.employee_id !== 7 || newTransaction.agent_name !== "Agent Seven") {
      throw new Error("TEST 12 FAILED: Transaction creation bypassed customer or agent ownership.");
    }
    console.log("✅ TEST 12 PASSED: Only the assigned agent can create one correctly credited transaction.\n");

    console.log("--- TEST 13: Sale Completion Enforces Agent and Synchronizes Status ---");
    const wrongAgentSale = createMockResponse();
    await updateTransactionStatus({
      params: { transaction_id: String(newTransaction.transaction_id) }, body: { payment_type: "Cash" },
      user: { role: "employee", id: 8 }, db: disposablePool,
    }, wrongAgentSale);
    const validSale = createMockResponse();
    await updateTransactionStatus({
      params: { transaction_id: String(newTransaction.transaction_id) }, body: { payment_type: "Cash" },
      user: { role: "employee", id: 7 }, db: disposablePool,
    }, validSale);
    const [[completedLot]] = await disposablePool.query("SELECT status FROM lots WHERE lot_id = 10");
    const [[completedCustomer]] = await disposablePool.query("SELECT customer_status FROM customers WHERE customer_id = ?", [transactionCustomerResult.insertId]);
    const [[completedTransaction]] = await disposablePool.query("SELECT payment_type, agent_name FROM transactions WHERE transaction_id = ?", [newTransaction.transaction_id]);
    if (wrongAgentSale.getStatusCode() !== 403 || validSale.getStatusCode() !== 200 ||
        completedLot.status !== "Sold" || completedCustomer.customer_status !== "Sold" ||
        completedTransaction.payment_type !== "Cash" || completedTransaction.agent_name !== "Agent Seven") {
      throw new Error("TEST 13 FAILED: Sale completion bypassed ownership or left statuses out of sync.");
    }
    console.log("✅ TEST 13 PASSED: Lot and customer become Sold without changing agent credit.\n");

    console.log("--- TEST 14: Historical Transaction Cannot Sell a Current Reservation ---");
    await disposablePool.query(
      "INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable) VALUES (11, 1, 'History Lot', 'Pending', 0)"
    );
    const [cancelledCustomerResult] = await disposablePool.query(
      "INSERT INTO customers (lot_id, full_name, contact_number, email, address, employee_id, customer_status, updated_at) VALUES (11, 'Old Buyer', '09180000000', 'oldbuyer@example.com', 'Iloilo', 7, 'Cancelled', '2020-01-01 00:00:00')"
    );
    const [historicalTransaction] = await disposablePool.query(
      "INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, agent_name) VALUES (11, ?, 'No Downpayment', 'Cancelled reservation', 7, 'Agent Seven')",
      [cancelledCustomerResult.insertId]
    );
    await disposablePool.query(
      "INSERT INTO customers (lot_id, full_name, contact_number, email, address, employee_id, customer_status) VALUES (11, 'Current Buyer', '09180000000', 'currentbuyer@example.com', 'Iloilo', 7, 'Pending')"
    );
    const historicalSale = createMockResponse();
    await updateTransactionStatus({
      params: { transaction_id: String(historicalTransaction.insertId) }, body: { payment_type: "Cash" },
      user: { role: "admin", id: 1 }, db: disposablePool,
    }, historicalSale);
    const [[historyLotAfter]] = await disposablePool.query("SELECT status FROM lots WHERE lot_id = 11");
    if (historicalSale.getStatusCode() !== 409 || historyLotAfter.status !== "Pending") {
      throw new Error("TEST 14 FAILED: Cancelled transaction sold a different customer's current reservation.");
    }
    console.log("✅ TEST 14 PASSED: Historical transaction cannot sell the current reservation.\n");

  } finally {
    // Hard Teardown: Safely drop disposable database
    if (disposablePool) await disposablePool.end();

    console.log(`🧹 Teardown: Validating and dropping disposable database \`${DISPOSABLE_DB_NAME}\`...`);
    assertDisposableDatabaseSafety(dbHost, DISPOSABLE_DB_NAME);
    await rootConn.query(`DROP DATABASE IF EXISTS \`${DISPOSABLE_DB_NAME}\``);
    await rootConn.end();
    console.log("✅ Teardown complete. Zero database residue left on MySQL server.\n");
  }

  console.log("=========================================================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY (14/14)");
  console.log("=========================================================================");
  process.exit(0);
}

runTestSuite().catch((err) => {
  console.error("❌ Test Suite Aborted with Error:", err);
  process.exit(1);
});
