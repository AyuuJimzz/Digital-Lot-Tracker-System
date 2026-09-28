/**
 * Automated Acceptance Test Suite for Sale Reversal, Resale, Date Provenance, & Analytics Integrity
 * Running strictly against an ISOLATED DISPOSABLE DATABASE.
 *
 * Invariants & Coverage Required by Codex:
 * 1. Hard Safety Checks:
 *    - Host validation: Only allowed on localhost / 127.0.0.1.
 *    - Disposable DB naming: Must start with `disposable_test_safeguard_`.
 * 2. True OLD Schema Phase (Zero provenance columns):
 *    - Missing-schema manual review: Must return HTTP 409, leave lots.sold_on and transactions unchanged.
 *    - Unknown legacy Cash transaction & synthetic backfill on OLD schema: Must NOT enter dated charts; counted in undated & inventory.
 * 3. Pre-Migration Audit & Plan (NULL-safe & Exhaustive):
 *    - Evaluated directly on True Old Schema without prior manual ALTER TABLE.
 *    - Handles transactions with NULL notes (especially payment_type='No Downpayment' with notes=NULL).
 *    - Mutually exclusive category counts: Sum of reversal, known_backfill, verified, and unknown_requires_review
 *      must EXACTLY equal total_transactions.
 * 4. Migration Execution on True Old Schema:
 *    - migrateDateProvenance() called directly on old schema: adds columns, classifies correctly, passes idempotent rerun.
 * 5. Flawed Old 'verified' Demotion (Separate Test):
 *    - Demotes old 'verified' lacking sold_on to unknown_requires_review (is_date_verified = 0).
 * 6. Historical 'manual_audit' Provenance Preservation:
 *    - Staff verification -> Sold-to-Available reversal (lots.sold_on becomes NULL) -> migration rerun.
 *    - Original historical transaction MUST retain is_date_verified = 1 and date_provenance = 'manual_audit'.
 * 7. Strict Date Validation & Multi-Year Analytics:
 *    - Rejects invalid dates (Feb 31, April 31, Month 13).
 *    - Multi-year separation: YTD vs prior years vs undated.
 * 8. Sell -> Reverse -> Resell & Guards:
 *    - Complete Sell -> Reverse -> Resell flow; Sold -> Pending blocked with HTTP 409.
 */

const mysql = require("mysql2/promise");
const assert = require("node:assert/strict");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const { updateLotStatus } = require("../src/controllers/lots/lotStatusController");
const { getTransactions, updateTransactionStatus } = require("../src/controllers/transactionsController");
const {
  getMonthlySalesData,
  getTimeBasedPropertySales,
  getDashboardStats,
} = require("../src/controllers/lots/lotAnalyticsController");
const { migrateDateProvenance, computeMigrationPlan } = require("../scripts/migrate_date_provenance");

const DISPOSABLE_TEST_PREFIX = "disposable_test_safeguard_";
const ALLOWED_TEST_HOSTS = ["localhost", "127.0.0.1"];
const UNIQUE_NONCE = `${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
const DISPOSABLE_DB_NAME = `${DISPOSABLE_TEST_PREFIX}${UNIQUE_NONCE}`;

function assertDisposableDatabaseSafety(host, dbName) {
  if (!ALLOWED_TEST_HOSTS.includes(host)) {
    throw new Error(`🛑 Hard safety check failed: Invalid host "${host}".`);
  }
  if (!dbName || !dbName.startsWith(DISPOSABLE_TEST_PREFIX)) {
    throw new Error(`🛑 Hard safety check failed: DB "${dbName}" does not match disposable prefix.`);
  }
}

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

async function runAcceptanceTests() {
  console.log("=========================================================================");
  console.log(`🧪 STARTING DISPOSABLE ACCEPTANCE TEST SUITE (SALES-DATE INTEGRITY & RCA)`);
  console.log(`🎯 Target Disposable DB: [${DISPOSABLE_DB_NAME}]`);
  console.log("=========================================================================\n");

  const dbHost = process.env.DB_HOST || "localhost";
  const dbUser = process.env.DB_USER || "root";
  const dbPassword = process.env.DB_PASSWORD || "";
  const dbPort = Number(process.env.DB_PORT) || 3306;

  assertDisposableDatabaseSafety(dbHost, DISPOSABLE_DB_NAME);

  const rootConn = await mysql.createConnection({
    host: dbHost,
    user: dbUser,
    password: dbPassword,
    port: dbPort,
  });

  let disposablePool = null;

  try {
    await rootConn.query(`DROP DATABASE IF EXISTS \`${DISPOSABLE_DB_NAME}\``);
    await rootConn.query(`CREATE DATABASE \`${DISPOSABLE_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ Provisioned isolated disposable database: \`${DISPOSABLE_DB_NAME}\``);

    disposablePool = mysql.createPool({
      host: dbHost,
      user: dbUser,
      password: dbPassword,
      port: dbPort,
      database: DISPOSABLE_DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
    });

    // -------------------------------------------------------------------------
    // SEED TRUE OLD SCHEMA (NO is_date_verified, NO date_provenance COLUMNS)
    // -------------------------------------------------------------------------
    await disposablePool.query(`
      CREATE TABLE properties (
        property_id INT PRIMARY KEY AUTO_INCREMENT,
        property_name VARCHAR(255) NOT NULL,
        total_lots INT NOT NULL DEFAULT 10,
        status VARCHAR(50) NOT NULL DEFAULT 'active'
      ) ENGINE=InnoDB
    `);

    await disposablePool.query(`
      CREATE TABLE lots (
        lot_id INT PRIMARY KEY AUTO_INCREMENT,
        property_id INT NOT NULL,
        lot_number VARCHAR(100) NOT NULL,
        area_sqm DECIMAL(10, 2) NOT NULL DEFAULT 100.00,
        status VARCHAR(50) NOT NULL DEFAULT 'Available',
        is_non_saleable TINYINT(1) DEFAULT 0,
        sold_on DATE NULL DEFAULT NULL,
        pending_since DATETIME NULL,
        last_reminder_sent DATETIME NULL
      ) ENGINE=InnoDB
    `);

    await disposablePool.query(`
      CREATE TABLE employees (
        employee_id INT PRIMARY KEY AUTO_INCREMENT,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL
      ) ENGINE=InnoDB
    `);

    await disposablePool.query(`
      CREATE TABLE customers (
        customer_id INT PRIMARY KEY AUTO_INCREMENT,
        lot_id INT NULL,
        full_name VARCHAR(100) NOT NULL,
        contact_number VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL,
        address TEXT NOT NULL,
        employee_id INT NULL,
        customer_status VARCHAR(20) NULL DEFAULT 'Pending',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    // TRUE OLD SCHEMA: Zero provenance columns in transactions!
    await disposablePool.query(`
      CREATE TABLE transactions (
        transaction_id INT PRIMARY KEY AUTO_INCREMENT,
        lot_id INT NOT NULL,
        customer_id INT NULL,
        payment_type VARCHAR(50) NOT NULL,
        notes TEXT NULL,
        employee_id INT NULL,
        agent_name VARCHAR(255) NULL,
        transaction_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    await disposablePool.query(
      "INSERT INTO properties (property_id, property_name, total_lots) VALUES (1, 'Golden Dragon Heights', 10)"
    );
    await disposablePool.query(
      "INSERT INTO employees (employee_id, first_name, last_name) VALUES (1, 'Admin', 'User'), (7, 'Agent', 'Seven')"
    );

    console.log("✅ Seeded TRUE OLD SCHEMA (transactions table has NO provenance columns).\n");

    const currentYear = new Date().getFullYear();

    // -------------------------------------------------------------------------
    // TEST 1: Missing-Schema Manual Date Review & Conservative Analytics Fallback
    // -------------------------------------------------------------------------
    console.log("--- TEST 1: Missing-Schema Review & Conservative Fallback on OLD Schema ---");
    // Seed Lot 1 as Sold with NULL sold_on
    await disposablePool.query(
      "INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable, sold_on) VALUES (1, 1, 'Lot 1 (Old Schema)', 'Sold', 0, NULL)"
    );

    // Subtest 1.1: Missing-schema manual review must be safely rejected with HTTP 409
    const missingSchemaRes = createMockResponse();
    await updateLotStatus({
      params: { id: "1" },
      body: { status: "Sold", sold_on: `${currentYear}-03-15` },
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, missingSchemaRes);

    assert.equal(missingSchemaRes.getStatusCode(), 409, "Must return HTTP 409 when provenance columns are missing");
    assert.match(
      missingSchemaRes.getData().error,
      /missing date provenance columns/,
      "Error must explicitly mention missing date provenance columns"
    );

    // Verify DB remains unchanged
    const [[lot1Check]] = await disposablePool.query("SELECT sold_on FROM lots WHERE lot_id = 1");
    assert.equal(lot1Check.sold_on, null, "lots.sold_on must remain NULL when provenance schema is missing");

    // Subtest 1.1b: Sale completion via updateLotStatus on unmigrated schema must return HTTP 409 and roll back with ZERO partial changes
    await disposablePool.query(
      "INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable, sold_on) VALUES (7, 1, 'Lot 7 (Pending Old Schema)', 'Pending', 0, NULL)"
    );
    await disposablePool.query(
      "INSERT INTO customers (customer_id, lot_id, full_name, email, contact_number, address, customer_status) VALUES (7, 7, 'Customer Seven', 'cust7@example.com', '09170000007', 'Iloilo', 'Pending')"
    );

    const saleLotStatusOldRes = createMockResponse();
    await updateLotStatus({
      params: { id: "7" },
      body: { status: "Sold", paymentMethod: "Cash" },
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, saleLotStatusOldRes);

    assert.equal(saleLotStatusOldRes.getStatusCode(), 409, "Sale completion via updateLotStatus on old schema must return HTTP 409");
    assert.match(
      saleLotStatusOldRes.getData().error,
      /missing date provenance columns/,
      "Error must explicitly mention missing date provenance columns"
    );

    // Verify ZERO partial changes on Lot 7
    const [[lot7Check]] = await disposablePool.query("SELECT status, sold_on FROM lots WHERE lot_id = 7");
    const [[cust7Check]] = await disposablePool.query("SELECT customer_status FROM customers WHERE customer_id = 7");
    const [txn7Rows] = await disposablePool.query("SELECT * FROM transactions WHERE lot_id = 7");
    assert.equal(lot7Check.status, "Pending", "Lot 7 status must remain Pending after rollback");
    assert.equal(lot7Check.sold_on, null, "Lot 7 sold_on must remain NULL after rollback");
    assert.equal(cust7Check.customer_status, "Pending", "Customer 7 status must remain Pending after rollback");
    assert.equal(txn7Rows.length, 0, "No transaction must be created for Lot 7 after rollback");

    // Clean up temporary Lot 7 to keep TEST 2 counts pristine
    await disposablePool.query("DELETE FROM customers WHERE customer_id = 7");
    await disposablePool.query("DELETE FROM lots WHERE lot_id = 7");

    // Subtest 1.1c: Sale completion via updateTransactionStatus on unmigrated schema must return HTTP 409 and roll back with ZERO partial changes
    await disposablePool.query(
      "INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable, sold_on) VALUES (88, 1, 'Lot 88 (Pending Old Schema)', 'Pending', 0, NULL)"
    );
    await disposablePool.query(
      "INSERT INTO customers (customer_id, lot_id, full_name, email, contact_number, address, customer_status, employee_id) VALUES (88, 88, 'Customer 88', 'cust88@example.com', '09170000088', 'Iloilo', 'Pending', 1)"
    );
    await disposablePool.query(
      `INSERT INTO transactions (transaction_id, lot_id, customer_id, payment_type, notes, employee_id, transaction_date)
       VALUES (888, 88, 88, 'No Downpayment', 'Pending reservation record', 1, '${currentYear}-03-01 10:00:00')`
    );

    const txnUpdateOldRes = createMockResponse();
    await updateTransactionStatus({
      params: { transaction_id: 888 },
      body: { payment_type: "Cash" },
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, txnUpdateOldRes);

    assert.equal(txnUpdateOldRes.getStatusCode(), 409, "Sale completion via updateTransactionStatus on old schema must return HTTP 409");
    assert.match(
      txnUpdateOldRes.getData().error,
      /missing date provenance columns/,
      "Error must explicitly mention missing date provenance columns"
    );

    // Verify ZERO partial changes on Lot 88
    const [[lot88Check]] = await disposablePool.query("SELECT status, sold_on FROM lots WHERE lot_id = 88");
    const [[cust88Check]] = await disposablePool.query("SELECT customer_status FROM customers WHERE customer_id = 88");
    const [[txn888Check]] = await disposablePool.query("SELECT payment_type, transaction_date FROM transactions WHERE transaction_id = 888");
    assert.equal(lot88Check.status, "Pending", "Lot 88 status must remain Pending after rollback");
    assert.equal(lot88Check.sold_on, null, "Lot 88 sold_on must remain NULL after rollback");
    assert.equal(cust88Check.customer_status, "Pending", "Customer 88 status must remain Pending after rollback");
    assert.equal(txn888Check.payment_type, "No Downpayment", "Transaction 888 payment_type must remain unchanged");

    // Clean up temporary Lot 88 to keep TEST 2 counts pristine
    await disposablePool.query("DELETE FROM transactions WHERE transaction_id = 888");
    await disposablePool.query("DELETE FROM customers WHERE customer_id = 88");
    await disposablePool.query("DELETE FROM lots WHERE lot_id = 88");

    // Seed Lot 2: Synthetic backfill that has a populated sold_on
    await disposablePool.query(
      `INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable, sold_on) 
       VALUES (2, 1, 'Lot 2 (Backfill with sold_on)', 'Sold', 0, '${currentYear}-03-10')`
    );
    await disposablePool.query(
      `INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, transaction_date)
       VALUES (2, NULL, 'No Downpayment', 'Reservation record', 7, '${currentYear}-03-10 10:00:00')`
    );

    // Seed Lot 3: UNKNOWN LEGACY CASH TRANSACTION with NULL notes on Sold lot
    await disposablePool.query(
      "INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable, sold_on) VALUES (3, 1, 'Lot 3 (Legacy Cash, NULL Notes)', 'Sold', 0, NULL)"
    );
    await disposablePool.query(
      `INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, transaction_date)
       VALUES (3, NULL, 'Cash', NULL, 7, '${currentYear}-03-12 11:00:00')`
    );

    // Seed Lot 4: Legitimate old sale with explicit sold_on
    await disposablePool.query(
      `INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable, sold_on) 
       VALUES (4, 1, 'Lot 4 (Legitimate Old Sale)', 'Sold', 0, '${currentYear}-01-15')`
    );
    await disposablePool.query(
      `INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, transaction_date)
       VALUES (4, NULL, 'Bank Transfer', 'Legitimate old sale', 7, '${currentYear}-01-15 09:00:00')`
    );

    // Seed Lot 100: Synthetic backfill with NULL notes
    await disposablePool.query(
      "INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable, sold_on) VALUES (100, 1, 'Lot 100 (Backfill, NULL Notes)', 'Sold', 0, NULL)"
    );
    await disposablePool.query(
      `INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, transaction_date)
       VALUES (100, NULL, 'No Downpayment', NULL, 7, '${currentYear}-03-01 10:00:00')`
    );

    // Seed Lot 99: Available lot with Reversal record
    await disposablePool.query(
      "INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable, sold_on) VALUES (99, 1, 'Lot 99 (Reversed)', 'Available', 0, NULL)"
    );
    await disposablePool.query(
      `INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, transaction_date)
       VALUES (99, NULL, 'Reversal', 'Cancelled reservation', 1, '${currentYear}-02-01 10:00:00')`
    );

    // Subtest 1.2: Conservative Analytics Fallback on OLD Schema
    // Invariant: Before migration, NO unreviewed legacy transactions may enter dated monthly charts!
    const resMonthlyOld = createMockResponse();
    await getMonthlySalesData({ db: disposablePool }, resMonthlyOld);
    const reportOld = resMonthlyOld.getData();
    const mDataOld = reportOld.monthlyData || reportOld;

    const totalDatedSalesOld = mDataOld.reduce((sum, m) => sum + (m.lotsSold || 0), 0);
    assert.equal(totalDatedSalesOld, 0, "Before migration, dated monthly chart must be strictly 0 (no unreviewed dates plotted)");
    assert.equal(reportOld.undatedSoldLots, 5, "All 5 sold lots (Lots 1, 2, 3, 4, 100) must be in undatedSoldLots");
    assert.equal(reportOld.allTimeSoldLots, 5, "All-time sold lots must equal 5 in inventory");

    // Subtest 1.3: Read-Only Views Remain Functional on OLD Schema
    const resGetTxnsOld = createMockResponse();
    await getTransactions({ db: disposablePool }, resGetTxnsOld);
    assert.equal(resGetTxnsOld.getStatusCode(), 200, "getTransactions must succeed on old schema");
    assert.ok(Array.isArray(resGetTxnsOld.getData()), "getTransactions must return array of records");
    assert.equal(resGetTxnsOld.getData().length >= 5, true, "Transactions view must list records without schema errors");

    console.log("✅ TEST 1 PASSED: Missing-schema review safely rejected; read-only views preserved; unknown legacy Cash transaction not plotted on old schema.\n");

    // -------------------------------------------------------------------------
    // TEST 2: Pre-Migration Plan on True Old Schema (Testing NULL Notes & Exact Partition Sum)
    // -------------------------------------------------------------------------
    console.log("--- TEST 2: Pre-Migration Plan on True Old Schema (NULL-Safe & Exhaustive) ---");
    // Directly call computeMigrationPlan while provenance columns DO NOT exist (NO manual ALTER TABLE!)
    const plan = await computeMigrationPlan(disposablePool);
    console.log("Computed Plan on True Old Schema:", plan);

    assert.equal(plan.totalTransactions, 5, "Total transactions must be exactly 5 (Txns 2, 3, 4, 100, 99)");
    assert.equal(plan.reversalCount, 1, "Exactly 1 reversal (Lot 99)");
    assert.equal(plan.knownBackfillCount, 2, "Exactly 2 known backfills (Lot 2 with notes + Lot 100 with NULL notes)");
    assert.equal(plan.verifiedWithSoldOnCount, 1, "Exactly 1 verified transaction with sold_on (Lot 4)");
    assert.equal(plan.unknownRequiresReviewCount, 1, "Exactly 1 unknown requiring review (Lot 3 Cash with NULL notes)");

    const categorySum = plan.reversalCount + plan.knownBackfillCount + plan.verifiedWithSoldOnCount + plan.unknownRequiresReviewCount;
    assert.equal(
      categorySum,
      plan.totalTransactions,
      `Category sum (${categorySum}) must EXACTLY equal totalTransactions (${plan.totalTransactions})`
    );
    console.log("✅ TEST 2 PASSED: Pre-migration plan on true old schema is mutually exclusive and exhaustive with NULL notes.\n");

    // -------------------------------------------------------------------------
    // TEST 3: Calling migrateDateProvenance() on True Old Schema Without Prior ALTER TABLE
    // -------------------------------------------------------------------------
    console.log("--- TEST 3: Calling migrateDateProvenance() Directly on True Old Schema ---");
    // Directly invoke migrateDateProvenance on the true old schema
    const migrationResult = await migrateDateProvenance({ db: disposablePool });
    assert.equal(migrationResult.applied, true, "migrateDateProvenance must apply migration");

    // Verify columns were added automatically by migrateDateProvenance
    const [colsVerified] = await disposablePool.query("SHOW COLUMNS FROM transactions LIKE 'is_date_verified'");
    const [colsProvenance] = await disposablePool.query("SHOW COLUMNS FROM transactions LIKE 'date_provenance'");
    assert.equal(colsVerified.length, 1, "transactions.is_date_verified column must now exist");
    assert.equal(colsProvenance.length, 1, "transactions.date_provenance column must now exist");

    // Verify actual DB classifications:
    const [[txn2Row]] = await disposablePool.query("SELECT is_date_verified, date_provenance FROM transactions WHERE lot_id = 2");
    assert.equal(txn2Row.is_date_verified, 0);
    assert.equal(txn2Row.date_provenance, "unverified_backfill", "Txn 2 with sold_on must remain unverified_backfill");

    const [[txn100Row]] = await disposablePool.query("SELECT is_date_verified, date_provenance FROM transactions WHERE lot_id = 100");
    assert.equal(txn100Row.is_date_verified, 0);
    assert.equal(txn100Row.date_provenance, "unverified_backfill", "Txn 100 with NULL notes must be classified as unverified_backfill");

    const [[txn3Row]] = await disposablePool.query("SELECT is_date_verified, date_provenance FROM transactions WHERE lot_id = 3");
    assert.equal(txn3Row.is_date_verified, 0);
    assert.equal(txn3Row.date_provenance, "unknown_requires_review", "Txn 3 Cash with NULL notes must be unknown_requires_review");

    const [[txn4Row]] = await disposablePool.query("SELECT is_date_verified, date_provenance FROM transactions WHERE lot_id = 4");
    assert.equal(txn4Row.is_date_verified, 1);
    assert.equal(txn4Row.date_provenance, "verified", "Txn 4 with sold_on must be verified");

    const [[txn99Row]] = await disposablePool.query("SELECT is_date_verified, date_provenance FROM transactions WHERE lot_id = 99");
    assert.equal(txn99Row.is_date_verified, 0);
    assert.equal(txn99Row.date_provenance, "reversal", "Txn 99 must be reversal");

    // Rerun migration on migrated DB to verify idempotency (zero errors, zero duplicate columns)
    const rerunResult = await migrateDateProvenance({ db: disposablePool });
    assert.equal(rerunResult.applied, true, "Rerun must succeed cleanly without throwing duplicate column errors");
    console.log("✅ TEST 3 PASSED: migrateDateProvenance() executed directly on true old schema, added columns, and rerun was idempotent.\n");

    // -------------------------------------------------------------------------
    // TEST 3b: Post-Migration Sale Paths (Succeeding with proper provenance)
    // -------------------------------------------------------------------------
    console.log("--- TEST 3b: Post-Migration Sale Paths (system_recorded vs manual_audit) ---");
    // Subtest 3b.1: Normal sale completion via updateLotStatus succeeds with system_recorded
    await disposablePool.query(
      "INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable, sold_on) VALUES (7, 1, 'Lot 7 (Pending Migrated)', 'Pending', 0, NULL)"
    );
    await disposablePool.query(
      "INSERT INTO customers (customer_id, lot_id, full_name, email, contact_number, address, customer_status) VALUES (7, 7, 'Customer Seven', 'cust7@example.com', '09170000007', 'Iloilo', 'Pending')"
    );

    const saleLotStatusMigratedRes = createMockResponse();
    await updateLotStatus({
      params: { id: "7" },
      body: { status: "Sold", paymentMethod: "Cash" },
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, saleLotStatusMigratedRes);

    assert.equal(saleLotStatusMigratedRes.getStatusCode(), 200, "Sale completion on migrated schema must succeed with HTTP 200");
    const [[lot7Migrated]] = await disposablePool.query("SELECT status, sold_on FROM lots WHERE lot_id = 7");
    const [[cust7Migrated]] = await disposablePool.query("SELECT customer_status FROM customers WHERE customer_id = 7");
    const [[txn7Migrated]] = await disposablePool.query(
      "SELECT is_date_verified, date_provenance FROM transactions WHERE lot_id = 7 ORDER BY transaction_id DESC LIMIT 1"
    );
    assert.equal(lot7Migrated.status, "Sold", "Lot 7 status must be Sold");
    assert.ok(lot7Migrated.sold_on, "Lot 7 sold_on must be populated");
    assert.equal(cust7Migrated.customer_status, "Sold", "Customer 7 status must be Sold");
    assert.equal(txn7Migrated.is_date_verified, 1, "Transaction must have is_date_verified = 1");
    assert.equal(txn7Migrated.date_provenance, "system_recorded", "Normal sale must have date_provenance = 'system_recorded'");

    // Clean up temporary Lot 7
    await disposablePool.query("DELETE FROM transactions WHERE lot_id = 7");
    await disposablePool.query("DELETE FROM customers WHERE customer_id = 7");
    await disposablePool.query("DELETE FROM lots WHERE lot_id = 7");

    // Subtest 3b.2: Sale completion via updateTransactionStatus succeeds with system_recorded
    await disposablePool.query(
      "INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable, sold_on) VALUES (88, 1, 'Lot 88 (Pending Migrated)', 'Pending', 0, NULL)"
    );
    await disposablePool.query(
      "INSERT INTO customers (customer_id, lot_id, full_name, email, contact_number, address, customer_status, employee_id) VALUES (88, 88, 'Customer 88', 'cust88@example.com', '09170000088', 'Iloilo', 'Pending', 1)"
    );
    await disposablePool.query(
      `INSERT INTO transactions (transaction_id, lot_id, customer_id, payment_type, notes, employee_id, transaction_date)
       VALUES (888, 88, 88, 'No Downpayment', 'Pending reservation record', 1, '${currentYear}-03-01 10:00:00')`
    );

    const txnUpdateMigratedRes = createMockResponse();
    await updateTransactionStatus({
      params: { transaction_id: 888 },
      body: { payment_type: "Bank Transfer" },
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, txnUpdateMigratedRes);

    assert.equal(txnUpdateMigratedRes.getStatusCode(), 200, "updateTransactionStatus on migrated schema must succeed with HTTP 200");
    const [[lot88Migrated]] = await disposablePool.query("SELECT status, sold_on FROM lots WHERE lot_id = 88");
    const [[cust88Migrated]] = await disposablePool.query("SELECT customer_status FROM customers WHERE customer_id = 88");
    const [[txn888Migrated]] = await disposablePool.query(
      "SELECT payment_type, is_date_verified, date_provenance FROM transactions WHERE transaction_id = 888"
    );
    assert.equal(lot88Migrated.status, "Sold", "Lot 88 status must be Sold");
    assert.ok(lot88Migrated.sold_on, "Lot 88 sold_on must be populated");
    assert.equal(cust88Migrated.customer_status, "Sold", "Customer 88 status must be Sold");
    assert.equal(txn888Migrated.payment_type, "Bank Transfer");
    assert.equal(txn888Migrated.is_date_verified, 1);
    assert.equal(txn888Migrated.date_provenance, "system_recorded", "Transaction completion must assign date_provenance = 'system_recorded'");

    // Clean up temporary Lot 88
    await disposablePool.query("DELETE FROM transactions WHERE transaction_id = 888");
    await disposablePool.query("DELETE FROM customers WHERE customer_id = 88");
    await disposablePool.query("DELETE FROM lots WHERE lot_id = 88");

    // Subtest 3b.3: Admin sale with explicit historical sold_on succeeds with manual_audit
    await disposablePool.query(
      "INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable) VALUES (77, 1, 'Lot 77 (Manual Audit Sale)', 'Available', 0)"
    );
    const manualAuditSaleRes = createMockResponse();
    await updateLotStatus({
      params: { id: "77" },
      body: {
        status: "Sold",
        email: "cust77@example.com",
        fullName: "Cust 77",
        contactNumber: "09170000077",
        address: "Iloilo",
        paymentMethod: "Cash",
        sold_on: `${currentYear}-05-20`,
      },
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, manualAuditSaleRes);

    assert.equal(manualAuditSaleRes.getStatusCode(), 200, "Admin sale with explicit sold_on must succeed with HTTP 200");
    const [[lot77Migrated]] = await disposablePool.query("SELECT DATE_FORMAT(sold_on, '%Y-%m-%d') as sold_on, status FROM lots WHERE lot_id = 77");
    const [[txn77Migrated]] = await disposablePool.query(
      "SELECT is_date_verified, date_provenance FROM transactions WHERE lot_id = 77 ORDER BY transaction_id DESC LIMIT 1"
    );
    assert.equal(lot77Migrated.status, "Sold");
    assert.equal(lot77Migrated.sold_on, `${currentYear}-05-20`);
    assert.equal(txn77Migrated.is_date_verified, 1);
    assert.equal(txn77Migrated.date_provenance, "manual_audit", "Admin sale with explicit date override must assign date_provenance = 'manual_audit'");

    // Clean up temporary Lot 77
    await disposablePool.query("DELETE FROM transactions WHERE lot_id = 77");
    await disposablePool.query("DELETE FROM customers WHERE lot_id = 77");
    await disposablePool.query("DELETE FROM lots WHERE lot_id = 77");
    console.log("✅ TEST 3b PASSED: Post-migration sale paths succeed with proper system_recorded / manual_audit provenance.\n");

    // -------------------------------------------------------------------------
    // TEST 4: Separate Test for Database with Flawed Old 'verified' Labels
    // -------------------------------------------------------------------------
    console.log("--- TEST 4: Flawed Legacy 'verified' Label Demotion Test ---");
    // Seed Lot 50 as Sold with NULL sold_on
    await disposablePool.query(
      "INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable, sold_on) VALUES (50, 1, 'Lot 50 (Flawed Verified)', 'Sold', 0, NULL)"
    );
    // Seed Txn 50 erroneously stamped 'verified' from flawed legacy script
    await disposablePool.query(
      `INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, transaction_date, is_date_verified, date_provenance)
       VALUES (50, NULL, 'Cash', 'Legacy record erroneously stamped verified', 1, '${currentYear}-02-15 14:00:00', 1, 'verified')`
    );

    // Run migration
    await migrateDateProvenance({ db: disposablePool });

    // Assert: Txn 50 must be demoted to unknown_requires_review and is_date_verified = 0
    const [[txn50Check]] = await disposablePool.query("SELECT is_date_verified, date_provenance FROM transactions WHERE lot_id = 50");
    assert.equal(txn50Check.is_date_verified, 0, "Flawed verified row without sold_on must be demoted to is_date_verified = 0");
    assert.equal(txn50Check.date_provenance, "unknown_requires_review", "Provenance must be updated to unknown_requires_review");
    console.log("✅ TEST 4 PASSED: Flawed old 'verified' label without sold_on was safely demoted.\n");

    // -------------------------------------------------------------------------
    // TEST 5: System Sale & Manual Audit -> Sold-to-Available Reversal -> Migration Rerun (Preserving Provenance)
    // -------------------------------------------------------------------------
    console.log("--- TEST 5: System Sale & Manual Verification -> Reversal -> Migration Rerun (Preserve Provenance) ---");
    // Step 5.1: Staff verifies Lot 1 via manual audit
    const staffVerifyRes = createMockResponse();
    await updateLotStatus({
      params: { id: "1" },
      body: { status: "Sold", sold_on: `${currentYear}-03-25` },
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, staffVerifyRes);
    assert.equal(staffVerifyRes.getStatusCode(), 200, "Staff verification must succeed");

    const [[lot1TxnVerified]] = await disposablePool.query(
      "SELECT transaction_id, is_date_verified, date_provenance FROM transactions WHERE lot_id = 1 ORDER BY transaction_id DESC LIMIT 1"
    );
    assert.equal(lot1TxnVerified.is_date_verified, 1);
    assert.equal(lot1TxnVerified.date_provenance, "manual_audit", "Must be marked manual_audit");
    const verifiedTxnId = lot1TxnVerified.transaction_id;

    // Step 5.2: Admin reverts Lot 1 from Sold to Available
    const revertRes = createMockResponse();
    await updateLotStatus({
      params: { id: "1" },
      body: { status: "Available" },
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, revertRes);
    assert.equal(revertRes.getStatusCode(), 200, "Reversal must succeed");

    // Verify lots.sold_on is now NULL for Lot 1
    const [[lot1AfterRevert]] = await disposablePool.query("SELECT status, sold_on FROM lots WHERE lot_id = 1");
    assert.equal(lot1AfterRevert.status, "Available", "Lot 1 must now be Available");
    assert.equal(lot1AfterRevert.sold_on, null, "Lot 1 sold_on must be cleared to NULL upon reversal");

    // Step 5.3: Ordinary System Sale on Lot 8 (Recorded live by system)
    await disposablePool.query(
      "INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable) VALUES (8, 1, 'Lot 8 (Ordinary System Sale)', 'Available', 0)"
    );
    const systemSaleRes = createMockResponse();
    await updateLotStatus({
      params: { id: "8" },
      body: {
        status: "Sold",
        email: "systembuyer@example.com",
        fullName: "System Buyer",
        contactNumber: "09170000009",
        address: "Iloilo City",
        paymentMethod: "Cash",
      },
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, systemSaleRes);
    assert.equal(systemSaleRes.getStatusCode(), 200, "Ordinary system sale must succeed");

    const [[lot8Txn]] = await disposablePool.query(
      "SELECT transaction_id, is_date_verified, date_provenance, transaction_date FROM transactions WHERE lot_id = 8 ORDER BY transaction_id DESC LIMIT 1"
    );
    assert.equal(lot8Txn.is_date_verified, 1, "Ordinary system sale must have is_date_verified = 1");
    assert.equal(lot8Txn.date_provenance, "system_recorded", "Ordinary system sale must have date_provenance = 'system_recorded'");
    const lot8OriginalTxnDate = lot8Txn.transaction_date;

    // Step 5.4: Admin reverts Lot 8 from Sold to Available
    const revertLot8Res = createMockResponse();
    await updateLotStatus({
      params: { id: "8" },
      body: { status: "Available" },
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, revertLot8Res);
    assert.equal(revertLot8Res.getStatusCode(), 200, "Lot 8 reversal must succeed");

    const [[lot8AfterRevert]] = await disposablePool.query("SELECT status, sold_on FROM lots WHERE lot_id = 8");
    assert.equal(lot8AfterRevert.status, "Available");
    assert.equal(lot8AfterRevert.sold_on, null, "Lot 8 sold_on must be cleared to NULL upon reversal");

    // Step 5.5: Migration Rerun!
    // Invariant: Even though lots.sold_on is NULL on Lot 1 AND Lot 8, migration rerun MUST NOT demote
    // staff-verified manual_audit OR live system_recorded transactions!
    await migrateDateProvenance({ db: disposablePool });

    const [[lot1AfterRerun]] = await disposablePool.query(
      "SELECT is_date_verified, date_provenance FROM transactions WHERE transaction_id = ?",
      [verifiedTxnId]
    );
    assert.equal(lot1AfterRerun.is_date_verified, 1, "Historical manual_audit must retain is_date_verified = 1");
    assert.equal(lot1AfterRerun.date_provenance, "manual_audit", "Historical manual_audit must retain date_provenance = 'manual_audit'");

    const [[lot8AfterRerun]] = await disposablePool.query(
      "SELECT is_date_verified, date_provenance, transaction_date FROM transactions WHERE transaction_id = ?",
      [lot8Txn.transaction_id]
    );
    assert.equal(
      lot8AfterRerun.is_date_verified,
      1,
      "Historical system sale must retain is_date_verified = 1 after reversal and migration rerun"
    );
    assert.equal(
      lot8AfterRerun.date_provenance,
      "system_recorded",
      "Historical system sale must retain date_provenance = 'system_recorded' after reversal and migration rerun"
    );
    assert.equal(
      new Date(lot8AfterRerun.transaction_date).getTime(),
      new Date(lot8OriginalTxnDate).getTime(),
      "Historical transaction_date must remain untampered and preserved"
    );
    console.log("✅ TEST 5 PASSED: Staff-verified manual_audit and ordinary system_recorded transactions were preserved through reversal and migration rerun.\n");

    // -------------------------------------------------------------------------
    // TEST 6: Strict Date Validation Edge Cases
    // -------------------------------------------------------------------------
    console.log("--- TEST 6: Strict Date Validation Edge Cases ---");
    // Re-sell Lot 1 to test validation
    const invalidDateRes1 = createMockResponse();
    await updateLotStatus({
      params: { id: "1" },
      body: { status: "Sold", sold_on: "2026-02-31" }, // Feb 31 does not exist
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, invalidDateRes1);
    assert.equal(invalidDateRes1.getStatusCode(), 400, "Must reject Feb 31 with HTTP 400");

    const invalidDateRes2 = createMockResponse();
    await updateLotStatus({
      params: { id: "1" },
      body: { status: "Sold", sold_on: "2026-04-31" }, // April 31 does not exist
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, invalidDateRes2);
    assert.equal(invalidDateRes2.getStatusCode(), 400, "Must reject April 31 with HTTP 400");

    const invalidDateRes3 = createMockResponse();
    await updateLotStatus({
      params: { id: "1" },
      body: { status: "Sold", sold_on: "not-a-date" },
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, invalidDateRes3);
    assert.equal(invalidDateRes3.getStatusCode(), 400, "Must reject non-date with HTTP 400");
    console.log("✅ TEST 6 PASSED: Strict date validator rejected invalid dates and rollovers.\n");

    // -------------------------------------------------------------------------
    // TEST 7: Multi-Year Analytics & Prior Year Separation
    // -------------------------------------------------------------------------
    console.log("--- TEST 7: Multi-Year Analytics & Prior Year Separation ---");
    // Re-verify Lot 1 with a valid date in current year (March)
    await updateLotStatus({
      params: { id: "1" },
      body: {
        status: "Sold",
        sold_on: `${currentYear}-03-25`,
        email: "customer1@example.com",
        fullName: "Customer 1",
        contactNumber: "09170000001",
        address: "Iloilo",
        paymentMethod: "Cash",
      },
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, createMockResponse());

    // Seed Lot 5 with a verified sale in prior year (2025-07-15)
    const priorYear = currentYear - 1;
    await disposablePool.query(
      `INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable, sold_on) 
       VALUES (5, 1, 'Lot 5 (Prior Year)', 'Sold', 0, '${priorYear}-07-15')`
    );
    await disposablePool.query(
      `INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, transaction_date, is_date_verified, date_provenance)
       VALUES (5, NULL, 'Cash', 'Prior year sale', 1, '${priorYear}-07-15 10:00:00', 1, 'verified')`
    );

    const resMultiYear = createMockResponse();
    await getMonthlySalesData({ db: disposablePool }, resMultiYear);
    const reportMultiYear = resMultiYear.getData();
    const mDataMultiYear = reportMultiYear.monthlyData || reportMultiYear;

    // YTD verified sales should show Lot 4 (Jan) and Lot 1 (Mar)
    const currentYearSum = mDataMultiYear.reduce((sum, m) => sum + (m.lotsSold || 0), 0);
    assert.equal(currentYearSum, 2, "Current year chart must reflect current year verified sales (Lot 4 in Jan + Lot 1 in March)");
    assert.equal(reportMultiYear.priorYearsVerifiedSoldLots, 1, "Prior years verified count must be 1 (Lot 5)");
    assert.equal(reportMultiYear.undatedSoldLots, 4, "Undated count must be 4 (Lots 2, 3, 50, 100)");
    assert.equal(reportMultiYear.allTimeSoldLots, 7, "All-time sold lots must be 7 (Lots 1, 2, 3, 4, 5, 50, 100)");
    assert.equal(reportMultiYear.totalSoldLots, 7, "totalSoldLots must equal 7");

    // Test real controller invocation of getTimeBasedPropertySales
    for (const period of ["today", "this week", "this month", "this year", "all"]) {
      const resPeriod = createMockResponse();
      await getTimeBasedPropertySales({ query: { period }, db: disposablePool }, resPeriod);
      assert.equal(resPeriod.getStatusCode(), 200, `getTimeBasedPropertySales for ${period} must return 200`);
    }
    console.log("✅ TEST 7 PASSED: Multi-year analytics accurately separates YTD, prior years, undated, and all-time inventory.\n");

    // -------------------------------------------------------------------------
    // TEST 8: Full Sell -> Reverse -> Resell Flow & Sold -> Pending Guard
    // -------------------------------------------------------------------------
    console.log("--- TEST 8: Full Sell -> Reverse -> Resell Flow & Transition Guards ---");
    await disposablePool.query(
      "INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable) VALUES (6, 1, 'Lot 6 (Resale Flow)', 'Available', 0)"
    );

    // Step 8.1: Sell Lot 6
    const sellRes = createMockResponse();
    await updateLotStatus({
      params: { id: "6" },
      body: {
        status: "Sold",
        email: "buyerX@example.com",
        fullName: "Buyer X",
        contactNumber: "09170000006",
        address: "Iloilo City",
        paymentMethod: "Cash",
        sold_on: `${currentYear}-01-10`,
      },
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, sellRes);
    assert.equal(sellRes.getStatusCode(), 200);

    // Step 8.2: Reverse Lot 6 to Available
    const revRes = createMockResponse();
    await updateLotStatus({
      params: { id: "6" },
      body: { status: "Available" },
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, revRes);
    assert.equal(revRes.getStatusCode(), 200);

    // Step 8.3: Resell Lot 6 to Buyer Y in May
    const resellRes = createMockResponse();
    await updateLotStatus({
      params: { id: "6" },
      body: {
        status: "Sold",
        email: "buyerY@example.com",
        fullName: "Buyer Y",
        contactNumber: "09170000007",
        address: "Iloilo City",
        paymentMethod: "Cash",
        sold_on: `${currentYear}-05-20`,
      },
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, resellRes);
    assert.equal(resellRes.getStatusCode(), 200);

    // Verify Monthly Analytics reflects ONLY May for Lot 6 (Jan original sale cancelled, Feb reversal excluded)
    const resMonthlyResell = createMockResponse();
    await getMonthlySalesData({ db: disposablePool }, resMonthlyResell);
    const reportResell = resMonthlyResell.getData();
    const mDataResell = reportResell.monthlyData || reportResell;

    assert.equal(mDataResell.find((m) => m.month === "Jan")?.lotsSold, 1, "January should only reflect Lot 4, not reversed Lot 6");
    assert.equal(mDataResell.find((m) => m.month === "May")?.lotsSold, 1, "May must reflect exactly 1 resale (Lot 6)");

    // Guard: Sold -> Pending direct transition blocked with HTTP 409
    const badGuardRes = createMockResponse();
    await updateLotStatus({
      params: { id: "6" },
      body: {
        status: "Pending",
        email: "buyerZ@example.com",
        fullName: "Buyer Z",
        contactNumber: "09170000008",
        address: "Iloilo City",
      },
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, badGuardRes);
    assert.equal(badGuardRes.getStatusCode(), 409, "Direct Sold -> Pending transition must be blocked with HTTP 409");
    console.log("✅ TEST 8 PASSED: Sell -> Reverse -> Resell flow verified; Sold -> Pending guard blocked with HTTP 409.\n");

    // -------------------------------------------------------------------------
    // TEST 9: Completed Sale with 'No Downpayment' Payload -> Migration Rerun & Report Integrity
    // -------------------------------------------------------------------------
    console.log("--- TEST 9: Completed Sale with 'No Downpayment' Payload -> Migration Rerun ---");
    await disposablePool.query(
      "INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable) VALUES (9, 1, 'Lot 9 (No DP Sale)', 'Available', 0)"
    );

    // Step 9.1: Completed sale with paymentMethod = 'No Downpayment'
    const noDpSaleRes = createMockResponse();
    await updateLotStatus({
      params: { id: "9" },
      body: {
        status: "Sold",
        paymentMethod: "No Downpayment",
        email: "nodp@example.com",
        fullName: "No DP Buyer",
        contactNumber: "09170000010",
        address: "Iloilo City",
      },
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, noDpSaleRes);
    assert.equal(noDpSaleRes.getStatusCode(), 200, "Sale with No Downpayment payload must succeed");

    const [[txn9Row]] = await disposablePool.query(
      "SELECT transaction_id, payment_type, is_date_verified, date_provenance FROM transactions WHERE lot_id = 9 ORDER BY transaction_id DESC LIMIT 1"
    );
    assert.equal(txn9Row.payment_type, "No Downpayment");
    assert.equal(txn9Row.is_date_verified, 1, "Completed sale with No DP must be marked is_date_verified = 1");
    assert.equal(txn9Row.date_provenance, "system_recorded", "Must have date_provenance = 'system_recorded' when server sets date");

    // Step 9.2: Migration Rerun!
    // Invariant: Migration rerun MUST NOT convert this legitimate completed sale to 'unverified_backfill'!
    await migrateDateProvenance({ db: disposablePool });

    const [[txn9AfterRerun]] = await disposablePool.query(
      "SELECT is_date_verified, date_provenance FROM transactions WHERE transaction_id = ?",
      [txn9Row.transaction_id]
    );
    assert.equal(
      txn9AfterRerun.is_date_verified,
      1,
      "Completed sale with No DP must retain is_date_verified = 1 after migration rerun"
    );
    assert.equal(
      txn9AfterRerun.date_provenance,
      "system_recorded",
      "Completed sale with No DP must retain date_provenance = 'system_recorded' after migration rerun"
    );

    // Step 9.3: Verify Monthly Analytics includes Lot 9 in current month dated report!
    const resMonthlyNoDp = createMockResponse();
    await getMonthlySalesData({ db: disposablePool }, resMonthlyNoDp);
    const reportNoDp = resMonthlyNoDp.getData();
    const mDataNoDp = reportNoDp.monthlyData || reportNoDp;

    const curMonthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][new Date().getMonth()];
    const curMonthSales = mDataNoDp.find((m) => m.month === curMonthName)?.lotsSold || 0;
    assert.ok(curMonthSales >= 1, `Current month (${curMonthName}) dated sales chart must include the verified No Downpayment sale (Lot 9)`);
    console.log("✅ TEST 9 PASSED: Completed sale with 'No Downpayment' payload preserved across migration rerun and counted in dated report.\n");

    // -------------------------------------------------------------------------
    // TEST 10: Migration Rerun After Resale (Zero Phantom Sales & Preserved Dates)
    // -------------------------------------------------------------------------
    console.log("--- TEST 10: Migration Rerun After Resale (Zero Phantom Sales) ---");
    // Run migration again after Lot 6 was resold
    await migrateDateProvenance({ db: disposablePool });

    // Check all transactions for Lot 6 (Resold lot with manual dates in Test 8)
    const [lot6Txns] = await disposablePool.query(
      "SELECT transaction_id, payment_type, transaction_date, is_date_verified, date_provenance FROM transactions WHERE lot_id = 6 ORDER BY transaction_id ASC"
    );
    assert.equal(lot6Txns.length, 3, "Lot 6 must have exactly 3 audit records: original sale, reversal, and resale");

    const origSaleTxn = lot6Txns[0];
    const reversalTxn = lot6Txns[1];
    const resaleTxn = lot6Txns[2];

    assert.equal(origSaleTxn.is_date_verified, 1, "Original historical sale retains verified status");
    assert.equal(origSaleTxn.date_provenance, "manual_audit", "Original historical sale retains manual_audit provenance");
    assert.equal(reversalTxn.payment_type, "Reversal", "Reversal transaction is preserved");
    assert.equal(resaleTxn.is_date_verified, 1, "Resale transaction is verified");
    assert.equal(resaleTxn.date_provenance, "manual_audit", "Resale transaction is manual_audit");

    // Check monthly analytics:
    const resMonthlyPostRerun = createMockResponse();
    await getMonthlySalesData({ db: disposablePool }, resMonthlyPostRerun);
    const reportPostRerun = resMonthlyPostRerun.getData();
    const mDataPostRerun = reportPostRerun.monthlyData || reportPostRerun;

    assert.equal(mDataPostRerun.find((m) => m.month === "Jan")?.lotsSold, 1, "Jan sales must not include reversed Lot 6 (zero phantom sales)");
    assert.equal(mDataPostRerun.find((m) => m.month === "May")?.lotsSold, 1, "May sales must reflect Lot 6 resale");
    console.log("✅ TEST 10 PASSED: Migration rerun after resale produced zero phantom sales and preserved historical dates.\n");

    // -------------------------------------------------------------------------
    // TEST 11: Date-Provenance Lifecycle: Normal vs Manual Override -> Reversal -> Rerun -> Resale
    // -------------------------------------------------------------------------
    console.log("--- TEST 11: Date-Provenance Lifecycle: Normal vs Manual Override -> Reversal -> Rerun -> Resale ---");

    // Baseline monthly sales before TEST 11
    const resMonthlyBaseline = createMockResponse();
    await getMonthlySalesData({ db: disposablePool }, resMonthlyBaseline);
    const baselineReport = resMonthlyBaseline.getData();
    const baselineMData = baselineReport.monthlyData || baselineReport;
    const baselineApril = baselineMData.find((m) => m.month === "Apr")?.lotsSold || 0;
    const baselineAugust = baselineMData.find((m) => m.month === "Aug")?.lotsSold || 0;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const t11CurMonth = monthNames[new Date().getMonth()];
    const baselineCurrentMonth = baselineMData.find((m) => m.month === t11CurMonth)?.lotsSold || 0;

    // Part 11.1: Normal Sale without sold_on override -> system_recorded
    await disposablePool.query(
      "INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable) VALUES (11, 1, 'Lot 11 (Normal Sale)', 'Available', 0)"
    );
    const normalSaleRes = createMockResponse();
    await updateLotStatus({
      params: { id: "11" },
      body: {
        status: "Sold",
        email: "buyer11@example.com",
        fullName: "Buyer Eleven",
        contactNumber: "09170000011",
        address: "Iloilo City",
        paymentMethod: "Cash",
      },
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, normalSaleRes);
    assert.equal(normalSaleRes.getStatusCode(), 200);

    const [[txn11Row]] = await disposablePool.query(
      "SELECT transaction_id, is_date_verified, date_provenance, transaction_date FROM transactions WHERE lot_id = 11 ORDER BY transaction_id DESC LIMIT 1"
    );
    const [[lot11Row]] = await disposablePool.query("SELECT sold_on FROM lots WHERE lot_id = 11");
    assert.equal(txn11Row.is_date_verified, 1, "Normal sale without override must have is_date_verified = 1");
    assert.equal(txn11Row.date_provenance, "system_recorded", "Normal sale without override must have date_provenance = 'system_recorded'");
    assert.ok(lot11Row.sold_on, "lots.sold_on must be populated with server calendar date");
    const originalTxn11Date = txn11Row.transaction_date;

    // Part 11.2: Admin Sale with explicit historical sold_on override -> manual_audit
    await disposablePool.query(
      "INSERT INTO lots (lot_id, property_id, lot_number, status, is_non_saleable) VALUES (12, 1, 'Lot 12 (Historical Override)', 'Available', 0)"
    );
    const overrideSaleRes = createMockResponse();
    await updateLotStatus({
      params: { id: "12" },
      body: {
        status: "Sold",
        email: "buyer12@example.com",
        fullName: "Buyer Twelve",
        contactNumber: "09170000012",
        address: "Iloilo City",
        paymentMethod: "Cash",
        sold_on: `${currentYear}-04-18`,
      },
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, overrideSaleRes);
    assert.equal(overrideSaleRes.getStatusCode(), 200);

    const [[txn12Row]] = await disposablePool.query(
      "SELECT transaction_id, is_date_verified, date_provenance, transaction_date FROM transactions WHERE lot_id = 12 ORDER BY transaction_id DESC LIMIT 1"
    );
    const [[lot12Row]] = await disposablePool.query("SELECT DATE_FORMAT(sold_on, '%Y-%m-%d') as sold_on FROM lots WHERE lot_id = 12");
    assert.equal(txn12Row.is_date_verified, 1, "Admin sale with override must have is_date_verified = 1");
    assert.equal(txn12Row.date_provenance, "manual_audit", "Admin sale with explicit sold_on override must have date_provenance = 'manual_audit'");
    assert.equal(
      lot12Row.sold_on,
      `${currentYear}-04-18`,
      "lots.sold_on must exactly match the verified historical calendar date"
    );
    const originalTxn12Date = txn12Row.transaction_date;

    // Verify dated report places Lot 12 in April, NOT current month
    const resMonthlyCheck12 = createMockResponse();
    await getMonthlySalesData({ db: disposablePool }, resMonthlyCheck12);
    const report12 = resMonthlyCheck12.getData();
    const mData12 = report12.monthlyData || report12;
    const aprilAfterSale = mData12.find((m) => m.month === "Apr")?.lotsSold || 0;
    const curMonthAfterSale = mData12.find((m) => m.month === t11CurMonth)?.lotsSold || 0;
    assert.equal(aprilAfterSale, baselineApril + 1, "April sales count must increment by exactly 1 for Lot 12 historical sale");
    if (t11CurMonth !== "Apr") {
      assert.equal(curMonthAfterSale, baselineCurrentMonth + 1, "Current month sales count must increment by exactly 1 for Lot 11 sale");
    }

    // Part 11.3: Reverse BOTH Lots 11 and 12 (Sold -> Available)
    await updateLotStatus({
      params: { id: "11" },
      body: { status: "Available" },
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, createMockResponse());

    await updateLotStatus({
      params: { id: "12" },
      body: { status: "Available" },
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, createMockResponse());

    const [[lot11Rev]] = await disposablePool.query("SELECT sold_on FROM lots WHERE lot_id = 11");
    const [[lot12Rev]] = await disposablePool.query("SELECT sold_on FROM lots WHERE lot_id = 12");
    assert.equal(lot11Rev.sold_on, null, "Lot 11 sold_on must be NULL upon reversal");
    assert.equal(lot12Rev.sold_on, null, "Lot 12 sold_on must be NULL upon reversal");

    // Exact before/after monthly counts right after reversal
    const resMonthlyAfterRev = createMockResponse();
    await getMonthlySalesData({ db: disposablePool }, resMonthlyAfterRev);
    const reportRev = resMonthlyAfterRev.getData();
    const mDataRev = reportRev.monthlyData || reportRev;
    const aprilAfterRev = mDataRev.find((m) => m.month === "Apr")?.lotsSold || 0;
    const curMonthAfterRev = mDataRev.find((m) => m.month === t11CurMonth)?.lotsSold || 0;
    assert.equal(aprilAfterRev, baselineApril, "April sales count must drop exactly back to baseline after reversal");
    assert.equal(curMonthAfterRev, baselineCurrentMonth, "Current month sales count must drop exactly back to baseline after reversal");

    // Migration Rerun 1: Verify historical provenance is preserved across reversal
    await migrateDateProvenance({ db: disposablePool });

    const [[txn11AfterRerun1]] = await disposablePool.query(
      "SELECT is_date_verified, date_provenance FROM transactions WHERE transaction_id = ?",
      [txn11Row.transaction_id]
    );
    const [[txn12AfterRerun1]] = await disposablePool.query(
      "SELECT is_date_verified, date_provenance FROM transactions WHERE transaction_id = ?",
      [txn12Row.transaction_id]
    );
    assert.equal(txn11AfterRerun1.is_date_verified, 1);
    assert.equal(txn11AfterRerun1.date_provenance, "system_recorded", "Lot 11 retains system_recorded after reversal and rerun");
    assert.equal(txn12AfterRerun1.is_date_verified, 1);
    assert.equal(txn12AfterRerun1.date_provenance, "manual_audit", "Lot 12 retains manual_audit after reversal and rerun");

    // Verify monthly counts remain strictly at baseline after migration rerun 1 (zero phantom sales)
    const resMonthlyAfterRerun1 = createMockResponse();
    await getMonthlySalesData({ db: disposablePool }, resMonthlyAfterRerun1);
    const reportRerun1 = resMonthlyAfterRerun1.getData();
    const mDataRerun1 = reportRerun1.monthlyData || reportRerun1;
    const aprilAfterRerun1 = mDataRerun1.find((m) => m.month === "Apr")?.lotsSold || 0;
    const curMonthAfterRerun1 = mDataRerun1.find((m) => m.month === t11CurMonth)?.lotsSold || 0;
    assert.equal(aprilAfterRerun1, baselineApril, "April sales count must remain strictly at baseline after rerun 1");
    assert.equal(curMonthAfterRerun1, baselineCurrentMonth, "Current month sales count must remain strictly at baseline after rerun 1");

    // Part 11.4: Resale of BOTH Lots
    // Resell Lot 11 without override
    await updateLotStatus({
      params: { id: "11" },
      body: {
        status: "Sold",
        email: "buyer11B@example.com",
        fullName: "Buyer Eleven Resale",
        contactNumber: "09170000013",
        address: "Iloilo City",
        paymentMethod: "Cash",
      },
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, createMockResponse());

    // Resell Lot 12 with explicit historical date in August
    await updateLotStatus({
      params: { id: "12" },
      body: {
        status: "Sold",
        email: "buyer12B@example.com",
        fullName: "Buyer Twelve Resale",
        contactNumber: "09170000014",
        address: "Iloilo City",
        paymentMethod: "Cash",
        sold_on: `${currentYear}-08-22`,
      },
      user: { role: "admin", id: 1 },
      db: disposablePool,
    }, createMockResponse());

    // Migration Rerun 2: Verify both lots after resale
    await migrateDateProvenance({ db: disposablePool });

    const [txnsLot11] = await disposablePool.query(
      "SELECT is_date_verified, date_provenance, payment_type FROM transactions WHERE lot_id = 11 ORDER BY transaction_id ASC"
    );
    assert.equal(txnsLot11.length, 3, "Lot 11 must have 3 audit records");
    assert.equal(txnsLot11[0].date_provenance, "system_recorded", "Original sale retains system_recorded");
    assert.equal(txnsLot11[1].payment_type, "Reversal");
    assert.equal(txnsLot11[2].date_provenance, "system_recorded", "Resale gets system_recorded");

    const [txnsLot12] = await disposablePool.query(
      "SELECT is_date_verified, date_provenance, payment_type FROM transactions WHERE lot_id = 12 ORDER BY transaction_id ASC"
    );
    assert.equal(txnsLot12.length, 3, "Lot 12 must have 3 audit records");
    assert.equal(txnsLot12[0].date_provenance, "manual_audit", "Original sale retains manual_audit");
    assert.equal(txnsLot12[1].payment_type, "Reversal");
    assert.equal(txnsLot12[2].date_provenance, "manual_audit", "Resale gets manual_audit");

    // Invariant: original transaction_date of historical rows must NEVER be modified across reversal, rerun, and resale!
    const [[origTxn11Check]] = await disposablePool.query(
      "SELECT transaction_date FROM transactions WHERE transaction_id = ?",
      [txn11Row.transaction_id]
    );
    const [[origTxn12Check]] = await disposablePool.query(
      "SELECT transaction_date FROM transactions WHERE transaction_id = ?",
      [txn12Row.transaction_id]
    );
    assert.equal(
      new Date(origTxn11Check.transaction_date).getTime(),
      new Date(originalTxn11Date).getTime(),
      "Original historical transaction_date of Lot 11 must remain strictly unchanged"
    );
    assert.equal(
      new Date(origTxn12Check.transaction_date).getTime(),
      new Date(originalTxn12Date).getTime(),
      "Original historical transaction_date of Lot 12 must remain strictly unchanged"
    );

    // Verify analytics: exact before/after monthly counts (ZERO phantom sales)
    const resFinalMonthly = createMockResponse();
    await getMonthlySalesData({ db: disposablePool }, resFinalMonthly);
    const finalReport = resFinalMonthly.getData();
    const finalMData = finalReport.monthlyData || finalReport;

    const finalAprilSales = finalMData.find((m) => m.month === "Apr")?.lotsSold || 0;
    const finalAugustSales = finalMData.find((m) => m.month === "Aug")?.lotsSold || 0;
    const finalCurrentMonthSales = finalMData.find((m) => m.month === t11CurMonth)?.lotsSold || 0;

    assert.equal(
      finalAprilSales,
      baselineApril,
      "April sales count must equal baseline; reversed April sale must not count as phantom sale"
    );
    assert.equal(
      finalAugustSales,
      baselineAugust + 1,
      "August sales count must be exactly baseline + 1 (the single resale of Lot 12)"
    );
    if (t11CurMonth !== "Aug" && t11CurMonth !== "Apr") {
      assert.equal(
        finalCurrentMonthSales,
        baselineCurrentMonth + 1,
        "Current month sales count must be exactly baseline + 1 (the single resale of Lot 11)"
      );
    }

    // Verify per-lot result: exactly 1 net sale for Lot 11 and exactly 1 net sale for Lot 12
    const [lot11ActiveSales] = await disposablePool.query(
      `SELECT t.transaction_id FROM transactions t
       JOIN lots l ON t.lot_id = l.lot_id
       WHERE l.lot_id = 11 AND l.status = 'Sold'
         AND t.payment_type NOT IN ('Reversal', 'Cancelled')
         AND t.is_date_verified = 1
         AND NOT EXISTS (
           SELECT 1 FROM transactions rev
           WHERE rev.lot_id = l.lot_id
             AND (rev.payment_type IN ('Reversal', 'Cancelled') OR COALESCE(rev.notes, '') LIKE 'Reversal of Sale%')
             AND rev.transaction_id > t.transaction_id
         )`
    );
    assert.equal(lot11ActiveSales.length, 1, "Lot 11 must yield exactly 1 active net sale in reports (zero phantom sales)");

    const [lot12ActiveSales] = await disposablePool.query(
      `SELECT t.transaction_id FROM transactions t
       JOIN lots l ON t.lot_id = l.lot_id
       WHERE l.lot_id = 12 AND l.status = 'Sold'
         AND t.payment_type NOT IN ('Reversal', 'Cancelled')
         AND t.is_date_verified = 1
         AND NOT EXISTS (
           SELECT 1 FROM transactions rev
           WHERE rev.lot_id = l.lot_id
             AND (rev.payment_type IN ('Reversal', 'Cancelled') OR COALESCE(rev.notes, '') LIKE 'Reversal of Sale%')
             AND rev.transaction_id > t.transaction_id
         )`
    );
    assert.equal(lot12ActiveSales.length, 1, "Lot 12 must yield exactly 1 active net sale in reports (zero phantom sales)");

    console.log("✅ TEST 11 PASSED: Full lifecycle (normal vs manual override -> reversal -> rerun -> resale) verified with exact before/after monthly counts, preserved original transaction dates, and zero phantom sales.\n");

  } finally {
    if (disposablePool) {
      await disposablePool.end();
    }
    console.log(`🧹 Teardown: Safely dropping disposable database \`${DISPOSABLE_DB_NAME}\`...`);
    assertDisposableDatabaseSafety(dbHost, DISPOSABLE_DB_NAME);
    await rootConn.query(`DROP DATABASE IF EXISTS \`${DISPOSABLE_DB_NAME}\``);
    await rootConn.end();
    console.log("✅ Teardown complete. Zero database residue left on MySQL server.\n");
  }

  console.log("=========================================================================");
  console.log("🎉 ALL ACCEPTANCE TESTS PASSED (Real Controllers & Real Disposable DB)");
  console.log("=========================================================================");
  process.exit(0);
}

runAcceptanceTests().catch((err) => {
  console.error("❌ Acceptance Test Suite Failed:", err);
  process.exit(1);
});
