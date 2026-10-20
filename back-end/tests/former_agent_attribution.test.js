const assert = require("node:assert/strict");
const test = require("node:test");
const { classifyAgentStatus } = require("../src/utils/agentAttribution");

test("classifyAgentStatus correctly handles all employee lifecycle states", () => {
  // 1. Active employee
  assert.equal(
    classifyAgentStatus({ employeeId: 2, agentName: "Maria Santos", employeeStatus: "active" }),
    "active"
  );

  // 2. Inactive employee (may be reactivated later)
  assert.equal(
    classifyAgentStatus({ employeeId: 5, agentName: "Juan Dela Cruz", employeeStatus: "inactive" }),
    "inactive"
  );

  // 3. Deleted employee (account removed from employees table, but sale is attributed)
  assert.equal(
    classifyAgentStatus({ employeeId: 5, agentName: "Juan Dela Cruz", employeeStatus: null }),
    "inactive"
  );

  // 4. Admin transaction (no employee ID, agent is Admin)
  assert.equal(
    classifyAgentStatus({ employeeId: null, agentName: "Admin", employeeStatus: null }),
    "admin"
  );

  // 5. Unassigned entry (null employee ID, null agentName)
  assert.equal(
    classifyAgentStatus({ employeeId: null, agentName: null, employeeStatus: null }),
    "admin"
  );
});

test("getLotById falls back to customer.employee_id when transaction.employee_id is null (parity with getMapData)", async () => {
  const dbPath = require.resolve("../config/database_connection");
  const previousDb = require.cache[dbPath];

  let queryCaptured = null;
  let paramsCaptured = null;

  const fakeDb = {
    query: async (sql, params) => {
      if (sql.includes("FROM lots WHERE lot_id = ?")) {
        return [[{ lot_id: 10, lot_number: "Block 1 Lot 10", status: "Sold", sold_on: "2026-05-10" }]];
      }
      if (sql.includes("FROM customers WHERE lot_id = ?")) {
        return [[{ customer_id: 88, full_name: "Client Fallback", employee_id: 7 }]];
      }
      if (sql.includes("FROM transactions t")) {
        queryCaptured = sql;
        paramsCaptured = params;
        return [[{
          payment_type: "Cash",
          employee_id: 7,
          agent_name: "Agent Seven",
          agent_status: "active"
        }]];
      }
      return [[]];
    }
  };

  try {
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakeDb };
    delete require.cache[require.resolve("../src/controllers/lotsController")];
    const { getLotById } = require("../src/controllers/lotsController");

    let responseData = null;
    const res = {
      json: (data) => { responseData = data; },
      status: () => res
    };

    await getLotById({ params: { id: 10 } }, res);

    assert.ok(queryCaptured, "Must execute transaction query");
    assert.ok(queryCaptured.includes("COALESCE(t.employee_id, ?)"), "Transaction query must coalesce with customerEmpId for parity with getMapData");
    assert.equal(paramsCaptured[0], 7, "Must pass customer employee_id (7) as first coalesce parameter");
    assert.equal(responseData.agent_name, "Agent Seven");
    assert.equal(responseData.agent_status, "active");
  } finally {
    if (previousDb) {
      require.cache[dbPath] = previousDb;
    } else {
      delete require.cache[dbPath];
    }
    delete require.cache[require.resolve("../src/controllers/lotsController")];
  }
});

test("SQL classification logic maps correctly for active, inactive, deleted, and admin states", () => {
  // Simulates MySQL's CASE WHEN evaluation:
  // CASE
  //   WHEN COALESCE(t.employee_id, c.employee_id) IS NULL AND t.agent_name = 'Old Record' THEN 'legacy'
  //   WHEN COALESCE(t.employee_id, c.employee_id) IS NULL AND (t.agent_name IS NULL OR t.agent_name = 'Admin') THEN 'admin'
  //   WHEN e.status = 'active' THEN 'active'
  //   ELSE 'inactive'
  // END
  const evaluateSqlCase = (t_employee_id, c_employee_id, t_agent_name, e_status) => {
    const effectiveEmpId = t_employee_id ?? c_employee_id ?? null;
    if (effectiveEmpId === null && t_agent_name === "Old Record") {
      return "legacy";
    }
    if (effectiveEmpId === null && (!t_agent_name || t_agent_name === "Admin")) {
      return "admin";
    }
    if (e_status === "active") {
      return "active";
    }
    return "inactive";
  };

  // Legacy Old Record sale
  assert.equal(evaluateSqlCase(null, null, "Old Record", null), "legacy");
  // Active employee
  assert.equal(evaluateSqlCase(2, null, "Maria Santos", "active"), "active");
  // Inactive employee
  assert.equal(evaluateSqlCase(5, null, "Juan Dela Cruz", "inactive"), "inactive");
  // Deleted employee (e_status is null because left join returned null)
  assert.equal(evaluateSqlCase(5, null, "Juan Dela Cruz", null), "inactive");
  // Admin action
  assert.equal(evaluateSqlCase(null, null, "Admin", null), "admin");
  // Unassigned action
  assert.equal(evaluateSqlCase(null, null, null, null), "admin");
});

test("getMapData excludes Reversal/Cancelled transactions and partitions by lot_id, customer_id with accurate row response mapping", async () => {
  const dbPath = require.resolve("../config/database_connection");
  const previousDb = require.cache[dbPath];

  let mapQueryCaptured = null;

  const mockDbLotRows = [
    {
      lot_id: 101,
      property_id: 1,
      lot_number: "Block 1 Lot 101",
      area_sqm: 120,
      status: "Sold",
      pending_since: null,
      sold_on: "2026-03-15",
      is_non_saleable: 0,
      coordinates: '{"lat":14.5,"lng":121.0}',
      customer_name: "Multi-lot Buyer",
      customer_email: "buyer@example.com",
      customer_contact: "09171234567",
      employee_id: 42,
      agent_name: "Inactive Agent Test",
      agent_status: "inactive"
    }
  ];

  const fakeDb = {
    query: async (sql) => {
      if (sql.includes("FROM lots l") && sql.includes("LEFT JOIN")) {
        mapQueryCaptured = sql;
        return [mockDbLotRows];
      }
      if (sql.includes("SELECT property_id")) {
        return [[{ property_id: 1, property_name: "Golden Dragon Phase 1", location: "Bulacan" }]];
      }
      if (sql.includes("SELECT lot_id, lot_number")) {
        return [[{ lot_id: 101, lot_number: "Block 1 Lot 101", status: "Sold", is_non_saleable: 0, has_coordinates: 1 }]];
      }
      return [[]];
    }
  };

  try {
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakeDb };
    delete require.cache[require.resolve("../src/controllers/lotsController")];
    const { getMapData } = require("../src/controllers/lotsController");

    let jsonResult = null;
    const res = {
      json: (data) => { jsonResult = data; },
      status: () => res
    };

    await getMapData({}, res);

    assert.ok(mapQueryCaptured, "Must execute main map query");
    assert.ok(
      mapQueryCaptured.includes("payment_type NOT IN ('Reversal', 'Cancelled')"),
      "getMapData must exclude Reversal and Cancelled transactions"
    );
    assert.ok(
      mapQueryCaptured.includes("PARTITION BY lot_id, customer_id"),
      "getMapData must partition by both lot_id and customer_id to prevent multi-lot customer data bleeding"
    );

    // Verify row mapping behavior:
    assert.ok(jsonResult, "Must respond with JSON");
    assert.equal(jsonResult.lots.length, 1);
    assert.equal(jsonResult.lots[0].lot_id, 101);
    assert.equal(jsonResult.lots[0].agent_name, "Inactive Agent Test");
    assert.equal(jsonResult.lots[0].agent_status, "inactive", "Row transformation must preserve inactive agent_status");
  } finally {
    if (previousDb) {
      require.cache[dbPath] = previousDb;
    } else {
      delete require.cache[dbPath];
    }
    delete require.cache[require.resolve("../src/controllers/lotsController")];
  }
});

test("window partition logic: PARTITION BY lot_id, customer_id prevents cross-lot agent bleed for multi-lot buyers", () => {
  const transactions = [
    { transaction_id: 1, lot_id: 10, customer_id: 88, agent_name: "Agent Ten", payment_type: "Downpayment", date: "2026-01-01" },
    { transaction_id: 2, lot_id: 10, customer_id: 88, agent_name: "Admin", payment_type: "Reversal", date: "2026-01-15" },
    { transaction_id: 3, lot_id: 20, customer_id: 88, agent_name: "Agent Twenty", payment_type: "Downpayment", date: "2026-02-01" },
  ];

  // Helper simulating SQL window partition:
  const runPartition = (partitionKeys, filterOutReversals = true) => {
    const filtered = filterOutReversals
      ? transactions.filter(t => !["Reversal", "Cancelled"].includes(t.payment_type))
      : transactions;

    const groups = new Map();
    for (const txn of filtered) {
      const key = partitionKeys.map(k => txn[k]).join("_");
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(txn);
    }

    // Sort descending by date, id and pick rn = 1
    const result = new Map();
    for (const [key, rows] of groups.entries()) {
      rows.sort((a, b) => b.date.localeCompare(a.date) || b.transaction_id - a.transaction_id);
      result.set(key, rows[0]);
    }
    return result;
  };

  // 1. Faulty partition (PARTITION BY customer_id only):
  const faulty = runPartition(["customer_id"], true);
  // For customer 88, rn = 1 picks the transaction for Lot 20 ("Agent Twenty")!
  assert.equal(faulty.get("88").lot_id, 20);
  assert.equal(faulty.get("88").agent_name, "Agent Twenty"); // Bleeds into Lot 10!

  // 2. Fixed partition (PARTITION BY lot_id, customer_id):
  const fixed = runPartition(["lot_id", "customer_id"], true);
  // Lot 10 correctly resolves to Agent Ten (ignoring Reversal and ignoring Lot 20)
  assert.equal(fixed.get("10_88").agent_name, "Agent Ten");
  // Lot 20 correctly resolves to Agent Twenty
  assert.equal(fixed.get("20_88").agent_name, "Agent Twenty");
});

test("classifyAgentStatus correctly identifies legacy Old Record sales", () => {
  const { classifyAgentStatus } = require("../src/utils/agentAttribution");

  // Old Record with no employeeId -> legacy
  assert.equal(classifyAgentStatus({ employeeId: null, agentName: "Old Record", employeeStatus: null }), "legacy");
  assert.equal(classifyAgentStatus({ employeeId: null, agentName: "Legacy Record", employeeStatus: null }), "legacy");

  // Admin with no employeeId -> admin
  assert.equal(classifyAgentStatus({ employeeId: null, agentName: "Admin", employeeStatus: null }), "admin");
  assert.equal(classifyAgentStatus({ employeeId: null, agentName: "", employeeStatus: null }), "admin");

  // Active agent -> active
  assert.equal(classifyAgentStatus({ employeeId: 3, agentName: "Jane Doe", employeeStatus: "active" }), "active");

  // Inactive agent -> inactive
  assert.equal(classifyAgentStatus({ employeeId: 4, agentName: "John Doe", employeeStatus: "inactive" }), "inactive");

  // Former agent whose employee record was deleted -> inactive
  assert.equal(classifyAgentStatus({ employeeId: 5, agentName: "Deleted Rep", employeeStatus: null }), "inactive");

  // Old record with customer employeeId passed in -> still returns legacy (authoritative)
  assert.equal(classifyAgentStatus({ employeeId: 42, agentName: "Old Record", employeeStatus: "active" }), "legacy");
});

test("SQL case parity: Old Record overrides customer employeeId, guarantees legacy status, and classifies as historical", () => {
  // Simulates SQL logic across getLotById, getMapData, and getTransactions:
  const evaluateEmpId = (t_agent_name, t_employee_id, c_employee_id) => {
    if (t_agent_name === "Old Record") return null;
    return t_employee_id ?? c_employee_id ?? null;
  };

  const evaluateAgentStatus = (t_agent_name, t_employee_id, c_employee_id, e_status) => {
    if (t_agent_name === "Old Record") return "legacy";
    const effectiveEmpId = t_employee_id ?? c_employee_id ?? null;
    if (effectiveEmpId === null && (!t_agent_name || t_agent_name === "Admin")) return "admin";
    if (e_status === "active") return "active";
    return "inactive";
  };

  const evaluateIsHistorical = (t_agent_name, lot_status, sold_on, txn_date, current_year = 2026) => {
    if (t_agent_name === "Old Record") return 1;
    if (lot_status === "Sold" && (!sold_on || sold_on === "0000-00-00")) return 1;
    const effectiveDate = txn_date || sold_on;
    if (effectiveDate && new Date(effectiveDate).getFullYear() < current_year) return 1;
    return 0;
  };

  // 1. Transaction has 'Old Record', but customer had employee_id = 42 (active employee):
  // Old Record MUST prevail: employee_id is null, agent_status is 'legacy', is_historical is 1 (even in 2026!)
  assert.equal(evaluateEmpId("Old Record", null, 42), null);
  assert.equal(evaluateAgentStatus("Old Record", null, 42, "active"), "legacy");
  assert.equal(evaluateIsHistorical("Old Record", "Sold", "2026-10-03", "2026-10-03", 2026), 1);

  // 2. Normal agent sale: employee 42 active in current year is NOT historical
  assert.equal(evaluateEmpId("Maria Santos", 42, 42), 42);
  assert.equal(evaluateAgentStatus("Maria Santos", 42, 42, "active"), "active");
  assert.equal(evaluateIsHistorical("Maria Santos", "Sold", "2026-10-03", "2026-10-03", 2026), 0);
});

test("updateLotStatus: ordinary save on Sold lot never overwrites agent attribution, and is_old_record toggle handles legacy transitions safely", async () => {
  const dbPath = require.resolve("../config/database_connection");
  const previousDb = require.cache[dbPath];

  const executedQueries = [];

  // Stateful database mock simulating real rows and transactions:
  let mockLot = {
    lot_id: 50,
    lot_number: "Block 5 Lot 1",
    status: "Sold",
    property_id: 1,
    sold_on: "2026-02-15"
  };
  let mockCustomer = {
    customer_id: 10,
    lot_id: 50,
    employee_id: null,
    customer_status: "Sold"
  };
  let mockTransaction = {
    transaction_id: 99,
    lot_id: 50,
    customer_id: 10,
    employee_id: null,
    agent_name: "Admin",
    payment_type: "Cash"
  };

  let rollbackCalled = false;
  let commitCalled = false;

  const fakeConnection = {
    beginTransaction: async () => { rollbackCalled = false; commitCalled = false; },
    commit: async () => { commitCalled = true; },
    rollback: async () => { rollbackCalled = true; },
    release: () => {},
    query: async (sql, params) => {
      executedQueries.push({ sql, params });
      if (sql.includes("SHOW COLUMNS FROM transactions")) {
        return [[{ Field: "is_date_verified" }, { Field: "date_provenance" }]];
      }
      if (sql.includes("SHOW TABLES LIKE 'sale_date_audit'") || (sql.includes("information_schema.TABLES") && sql.includes("sale_date_audit"))) {
        return [[{ table_count: 1, Tables_in_db: "sale_date_audit" }]];
      }
      if (sql.includes("SELECT DATE_FORMAT(sold_on")) {
        return [[{ sold_on: mockLot.sold_on }]];
      }
      if (sql.includes("SELECT DATE_FORMAT(transaction_date")) {
        return [[{ transaction_date: "2024-05-15 12:00:00.000000" }]];
      }
      if (sql.includes("SELECT * FROM lots WHERE lot_id = ?")) {
        return [[{ ...mockLot }]];
      }
      if (sql.includes("SELECT customer_id, employee_id FROM customers")) {
        return [[{ ...mockCustomer }]];
      }
      if (sql.includes("SELECT transaction_id, employee_id, agent_name FROM transactions")) {
        return [[{ ...mockTransaction }]];
      }
      if (sql.includes("SELECT transaction_id FROM transactions")) {
        return [[{ ...mockTransaction }]];
      }
      if (sql.includes("SELECT * FROM properties")) {
        return [[{ property_id: 1, property_name: "Phase 1" }]];
      }
      if (sql.includes("FROM employees WHERE employee_id = ?")) {
        return [[{ employee_id: 5, first_name: "Maria", last_name: "Santos" }]];
      }

      // Stateful mutations:
      if (sql.includes("UPDATE transactions") && sql.includes("SET agent_name = 'Old Record', employee_id = NULL")) {
        mockTransaction.agent_name = "Old Record";
        mockTransaction.employee_id = null;
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("UPDATE transactions") && sql.includes("SET agent_name = 'Admin', employee_id = NULL")) {
        mockTransaction.agent_name = "Admin";
        mockTransaction.employee_id = null;
        return [{ affectedRows: 1 }];
      }

      return [[]];
    }
  };

  const fakeDb = {
    getConnection: async () => fakeConnection,
    query: async (sql, params) => fakeConnection.query(sql, params)
  };

  require.cache[dbPath] = { exports: fakeDb };
  delete require.cache[require.resolve("../src/controllers/lots/lotStatusController")];
  const { updateLotStatus } = require("../src/controllers/lots/lotStatusController");

  try {
    // SCENARIO 1: Ordinary save on existing Sold lot without is_old_record dirty
    // e.g. Admin edits customer name or contact number
    mockTransaction = { transaction_id: 99, lot_id: 50, customer_id: 10, employee_id: 5, agent_name: "Maria Santos", payment_type: "Cash" };
    executedQueries.length = 0;
    const req1 = {
      params: { id: 50 },
      body: {
        status: "Sold",
        fullName: "Updated Customer Name",
        contactNumber: "09189998888",
        // is_old_record is undefined because user did NOT touch the Old Record toggle
        is_old_record: undefined
      },
      user: { role: "admin", email: "admin@example.com" }
    };
    let res1Status = 200;
    const res1 = {
      status: (code) => { res1Status = code; return res1; },
      json: () => res1
    };

    await updateLotStatus(req1, res1);
    assert.equal(res1Status, 200);
    // Agent Maria Santos must be completely untouched
    assert.equal(mockTransaction.agent_name, "Maria Santos");
    assert.equal(mockTransaction.employee_id, 5);

    // SCENARIO 2: Mark -> Unmark lossless round-trip on Admin sale:
    // Step 2A: Initial state is Admin
    mockTransaction = { transaction_id: 99, lot_id: 50, customer_id: 10, employee_id: null, agent_name: "Admin", payment_type: "Cash" };
    const req2A = {
      params: { id: 50 },
      body: { status: "Sold", is_old_record: true },
      user: { role: "admin", email: "admin@example.com" }
    };
    let res2AStatus = 200;
    const res2A = {
      status: (code) => { res2AStatus = code; return res2A; },
      json: () => res2A
    };

    await updateLotStatus(req2A, res2A);
    assert.equal(res2AStatus, 200);
    assert.equal(mockTransaction.agent_name, "Old Record", "Marking as old record updates transaction agent_name to Old Record");
    assert.equal(mockTransaction.employee_id, null);

    // Step 2B: Admin unticks is_old_record: false -> must revert back to Admin (lossless round-trip!)
    const req2B = {
      params: { id: 50 },
      body: { status: "Sold", is_old_record: false },
      user: { role: "admin", email: "admin@example.com" }
    };
    let res2BStatus = 200;
    const res2B = {
      status: (code) => { res2BStatus = code; return res2B; },
      json: () => res2B
    };

    await updateLotStatus(req2B, res2B);
    assert.equal(res2BStatus, 200);
    assert.equal(mockTransaction.agent_name, "Admin", "Unticking old record restores original Admin seller attribution losslessly");
    assert.equal(mockTransaction.employee_id, null);

    // SCENARIO 3: Protection of Existing Agent Sales:
    // If the lot was sold by an assigned agent (Maria Santos, employee_id = 5),
    // marking as is_old_record: true must be strictly REJECTED with 400 Bad Request!
    mockTransaction = { transaction_id: 99, lot_id: 50, customer_id: 10, employee_id: 5, agent_name: "Maria Santos", payment_type: "Cash" };
    const req3 = {
      params: { id: 50 },
      body: { status: "Sold", is_old_record: true },
      user: { role: "admin", email: "admin@example.com" }
    };
    let res3Status = 200;
    let res3Error = "";
    const res3 = {
      status: (code) => { res3Status = code; return res3; },
      json: (data) => { res3Error = data.error; return res3; }
    };

    await updateLotStatus(req3, res3);
    assert.equal(res3Status, 400, "Must return 400 Bad Request when attempting to overwrite an assigned agent sale with Old Record");
    assert.ok(res3Error.includes("Cannot mark as Old Record"), "Must explain that agent sales are protected");
    assert.ok(rollbackCalled, "Must perform database rollback");
    // Maria Santos's sales history must be 100% preserved
    assert.equal(mockTransaction.agent_name, "Maria Santos");
    assert.equal(mockTransaction.employee_id, 5);

    // SCENARIO 4: Protection of Pending Reservations with an Assigned Agent:
    // If an Admin transitions an agent's pending reservation to Sold with is_old_record: true,
    // it must also be rejected with 400 Bad Request and not overwrite the reservation agent!
    mockLot.status = "Pending";
    mockCustomer.employee_id = 5; // Reserved by Maria Santos
    const req4 = {
      params: { id: 50 },
      body: { status: "Sold", is_old_record: true },
      user: { role: "admin", email: "admin@example.com" }
    };
    let res4Status = 200;
    let res4Error = "";
    const res4 = {
      status: (code) => { res4Status = code; return res4; },
      json: (data) => { res4Error = data.error; return res4; }
    };

    await updateLotStatus(req4, res4);
    assert.equal(res4Status, 400, "Must return 400 Bad Request when attempting to transition an agent reservation to Old Record");
    assert.ok(res4Error.includes("reservation is assigned to an agent"), "Must protect agent reservation credit");

    // SCENARIO 5: Legitimate Undated Sale Credited to an Assigned Agent (Pending -> Sold):
    // If an Admin encodes an undated sale for an agent (is_legacy_undated: true without is_old_record),
    // it MUST succeed with 200 OK and preserve agent attribution!
    mockLot.status = "Pending";
    mockCustomer.employee_id = 5; // Reserved by Maria Santos
    mockTransaction = { transaction_id: 99, lot_id: 50, customer_id: 10, employee_id: 5, agent_name: "Maria Santos", payment_type: "Cash" };
    executedQueries.length = 0;
    const req5 = {
      params: { id: 50 },
      body: {
        status: "Sold",
        is_legacy_undated: true,
        // is_old_record is undefined because agent sales never auto-enable Old Record!
        is_old_record: undefined
      },
      user: { role: "admin", email: "admin@example.com" }
    };
    let res5Status = 200;
    const res5 = {
      status: (code) => { res5Status = code; return res5; },
      json: () => res5
    };

    await updateLotStatus(req5, res5);
    assert.equal(res5Status, 200, "Must succeed with 200 OK when encoding a legitimate undated sale for an agent");

    const undatedLotUpdate = executedQueries.find(q =>
      q.sql.includes("UPDATE lots SET sold_on = NULL")
    );
    assert.ok(undatedLotUpdate, "Must set sold_on to NULL for undated sale");

    const txnUpdateWithAgent = executedQueries.find(q =>
      q.sql.includes("UPDATE transactions SET") && q.params && q.params.includes(5) && q.params.includes("Maria Santos")
    );
    assert.ok(txnUpdateWithAgent, "Must preserve employee_id 5 and agent_name Maria Santos in transaction");

    // SCENARIO 6: Legitimate Undated Update on an Already Sold Agent Lot (Sold -> Sold):
    // If an Admin marks an already sold lot with an assigned agent as undated (is_legacy_undated: true),
    // it MUST succeed with 200 OK without triggering the Old Record guard or wiping agent credit!
    mockLot.status = "Sold";
    mockLot.sold_on = "2024-05-15";
    mockTransaction = { transaction_id: 99, lot_id: 50, customer_id: 10, employee_id: 5, agent_name: "Maria Santos", payment_type: "Cash", is_date_verified: 1, date_provenance: "manual_audit" };
    executedQueries.length = 0;
    const req6 = {
      params: { id: 50 },
      body: {
        status: "Sold",
        is_legacy_undated: true
      },
      user: { role: "admin", email: "admin@example.com" }
    };
    let res6Status = 200;
    const res6 = {
      status: (code) => { res6Status = code; return res6; },
      json: () => res6
    };

    await updateLotStatus(req6, res6);
    assert.equal(res6Status, 200, "Must succeed with 200 OK when marking an already sold agent lot as undated");

    const lotNullDateUpdate = executedQueries.find(q =>
      q.sql.includes("UPDATE lots SET sold_on = ?") && q.params[0] === null
    );
    assert.ok(lotNullDateUpdate, "Must set sold_on to NULL in lots table for already sold lot");

    // Must NOT alter agent_name or employee_id to 'Old Record' or NULL
    const unwantedOldRecordUpdate = executedQueries.find(q =>
      q.sql.includes("UPDATE transactions SET agent_name = 'Old Record'")
    );
    assert.equal(unwantedOldRecordUpdate, undefined, "Must NOT update agent attribution to Old Record on undated date change");
  } finally {
    if (previousDb) {
      require.cache[dbPath] = previousDb;
    } else {
      require.cache[dbPath];
    }
    delete require.cache[require.resolve("../src/controllers/lots/lotStatusController")];
  }
});

test("getTransactions: team transactions visible by default, personal transactions filtered when scope=personal", async () => {
  const { getTransactions } = require("../src/controllers/transactionsController");

  let executedQuery1 = null;
  let executedParams1 = null;
  const mockDb1 = {
    execute: async (sql, params) => {
      executedQuery1 = sql;
      executedParams1 = params;
      return [[]];
    }
  };

  // Case 1: Employee on Dashboard (no scope=personal) -> must NOT filter by employee_id (sees full team activity & Old Records)
  const reqDashboard = {
    user: { role: "employee", id: 4 },
    query: {},
    db: mockDb1
  };
  const resDashboard = {
    json: () => {}
  };
  await getTransactions(reqDashboard, resDashboard);
  assert.equal(executedParams1.length, 0, "Default employee request must not inject employee_id filter");
  assert.equal(executedQuery1.includes("t.employee_id = ?"), false, "Default employee request must allow team transactions");

  // Case 2: Employee on My Sales (scope=personal) -> must filter by employee_id
  let executedQuery2 = null;
  let executedParams2 = null;
  const mockDb2 = {
    execute: async (sql, params) => {
      executedQuery2 = sql;
      executedParams2 = params;
      return [[]];
    }
  };
  const reqMySales = {
    user: { role: "employee", id: 4 },
    query: { scope: "personal" },
    db: mockDb2
  };
  const resMySales = {
    json: () => {}
  };
  await getTransactions(reqMySales, resMySales);
  assert.equal(executedParams2.length, 2, "My Sales request must inject employee_id in params");
  assert.equal(executedParams2[0], 4);
  assert.equal(executedQuery2.includes("t.employee_id = ?"), true, "My Sales request must filter by employee_id");

  // Case 3: Admin on Dashboard -> must never filter by employee_id
  let executedQuery3 = null;
  let executedParams3 = null;
  const mockDb3 = {
    execute: async (sql, params) => {
      executedQuery3 = sql;
      executedParams3 = params;
      return [[]];
    }
  };
  const reqAdmin = {
    user: { role: "admin", id: 1 },
    query: {},
    db: mockDb3
  };
  const resAdmin = {
    json: () => {}
  };
  await getTransactions(reqAdmin, resAdmin);
  assert.equal(executedParams3.length, 0, "Admin request must not inject employee_id filter");
  assert.equal(executedQuery3.includes("t.employee_id = ?"), false, "Admin request must see all transactions");
});

test("external sales agent attribution: classifyAgentStatus, getExternalAgents, and updateLotStatus with external_agent_name", async () => {
  // 1. classifyAgentStatus unit test for external agent
  assert.equal(
    classifyAgentStatus({ employeeId: null, agentName: "Juan Dela Cruz", employeeStatus: null }),
    "external",
    "Non-admin, non-legacy agent with null employeeId must be classified as 'external'"
  );

  // 2. getExternalAgents controller test
  const { getExternalAgents } = require("../src/controllers/transactionsController");
  let capturedQuery = null;
  const mockDb = {
    query: async (sql) => {
      capturedQuery = sql;
      return [[{ agent_name: "Juan Dela Cruz" }, { agent_name: "Pedro Penduko" }]];
    }
  };
  let responseData = null;
  const fakeReq = { db: mockDb };
  const fakeRes = {
    json: (data) => { responseData = data; }
  };
  await getExternalAgents(fakeReq, fakeRes);
  assert.deepEqual(responseData, ["Juan Dela Cruz", "Pedro Penduko"]);
  assert.equal(capturedQuery.includes("agent_name NOT IN ('Admin', 'Old Record', 'Legacy Record')"), true);
  assert.equal(capturedQuery.includes("employee_id IS NULL"), true);

  // 3. updateLotStatus with external_agent_name sets agent_name and nulls employee_id
  const { updateLotStatus } = require("../src/controllers/lots/lotStatusController");
  const updatesExecuted = [];
  const fakeConn = {
    query: async (sql, params) => {
      updatesExecuted.push({ sql, params });
      if (sql.includes("FROM lots WHERE lot_id = ?")) {
        return [[{ lot_id: 88, lot_number: "Block 1 Lot 88", status: "Available" }]];
      }
      if (sql.includes("SELECT customer_id FROM customers WHERE lot_id = ?")) {
        return [[{ customer_id: 101 }]];
      }
      if (sql.includes("FROM customers WHERE lot_id = ?")) {
        return [[]];
      }
      if (sql.includes("FROM transactions WHERE customer_id = ?")) {
        return [[]];
      }
      return [{ insertId: 101 }];
    },
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
  };
  const mockDbConn = {
    getConnection: async () => fakeConn,
    query: async (sql, params) => fakeConn.query(sql, params),
  };

  const reqStaffExternal = {
    params: { id: 88 },
    body: {
      status: "Pending",
      fullName: "Sample Buyer",
      contactNumber: "09123456789",
      email: "buyer@example.com",
      address: "Iloilo City",
      external_agent_name: "Juan Dela Cruz",
    },
    user: { role: "employee", id: 3, email: "denise@example.com" },
    db: mockDbConn,
  };
  let resultJson = null;
  let statusSet = 200;
  const resStaffExternal = {
    status: (s) => { statusSet = s; return resStaffExternal; },
    json: (d) => { resultJson = d; },
  };

  await updateLotStatus(reqStaffExternal, resStaffExternal);
  assert.equal(statusSet, 200);

  // Verify that in transactions, employee_id is NULL and agent_name is "Juan Dela Cruz"
  const txnInsert = updatesExecuted.find((u) => u.sql.includes("INSERT INTO transactions"));
  assert.ok(txnInsert, "Transaction must be inserted for reservation");
  // [id, customerId, notes, txnEmployeeId, txnAgentName]
  assert.equal(txnInsert.params[3], null, "External agent transaction must have employee_id as null");
  assert.equal(txnInsert.params[4], "Juan Dela Cruz", "Transaction must be credited to Juan Dela Cruz");

  // Verify that in customers, employee_id is still Denise (id: 3) so Denise can manage her pending reservation
  const custInsert = updatesExecuted.find((u) => u.sql.includes("INSERT INTO customers"));
  assert.ok(custInsert, "Customer must be inserted");
  assert.equal(custInsert.params[5], 3, "Customer must preserve reserving staff id for reservation permissions");
});

test("direct Available to Sold transition with is_old_record and partial customer details creates customer and transaction properly", async () => {
  const { updateLotStatus } = require("../src/controllers/lots/lotStatusController");

  const queriesRun = [];
  let insertedCustomerId = null;
  const fakeConn = {
    query: async (sql, params) => {
      queriesRun.push({ sql, params });
      if (sql.includes("FROM lots WHERE lot_id = ?")) {
        return [[{ lot_id: 8250, lot_number: "Block 4-H Lot 4", status: "Available" }]];
      }
      if (sql.includes("FROM customers WHERE lot_id = ?") && sql.includes("ORDER BY updated_at DESC")) {
        if (insertedCustomerId) {
          return [[{ customer_id: insertedCustomerId, employee_id: null, full_name: "SDSDSDSD" }]];
        }
        return [[]];
      }
      if (sql.includes("FROM transactions WHERE lot_id = ?")) {
        return [[]];
      }
      if (sql.includes("SHOW COLUMNS FROM transactions")) {
        return [[{ Field: "is_date_verified" }, { Field: "date_provenance" }]];
      }
      if (sql.includes("INSERT INTO customers")) {
        insertedCustomerId = 999;
        return [{ insertId: 999 }];
      }
      return [{ insertId: 1001 }];
    },
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
  };
  const mockDbConn = {
    getConnection: async () => fakeConn,
    query: async (sql, params) => fakeConn.query(sql, params),
  };

  const req = {
    params: { id: 8250 },
    body: {
      status: "Sold",
      fullName: "SDSDSDSD",
      contactNumber: "To be updated",
      email: "To be updated",
      address: "To be updated",
      paymentMethod: "Cash",
      is_legacy_undated: true,
      is_old_record: true,
    },
    user: { role: "admin", id: 1, email: "admin@example.com" },
    db: mockDbConn,
  };
  let resultJson = null;
  let statusCode = 200;
  const res = {
    status: (code) => { statusCode = code; return res; },
    json: (data) => { resultJson = data; },
  };

  await updateLotStatus(req, res);
  assert.equal(statusCode, 200);

  // 1. Verify customer was inserted with full_name = 'SDSDSDSD', customer_status = 'Sold'
  const custInsert = queriesRun.find((q) => q.sql.includes("INSERT INTO customers"));
  assert.ok(custInsert, "Customer must be inserted for Sold lot");
  // VALUES [id, safeFullName, safeContact, safeEmail, safeAddress, employeeId, status]
  assert.equal(custInsert.params[1], "SDSDSDSD", "Full name must be saved");
  assert.equal(custInsert.params[2], "To be updated", "Contact number must default to To be updated");
  assert.equal(custInsert.params[3], "To be updated", "Email must default to To be updated");
  assert.equal(custInsert.params[4], "To be updated", "Address must default to To be updated");
  assert.equal(custInsert.params[6], "Sold", "Customer status must be Sold, not Pending");

  // 2. Verify transaction was inserted with agent_name = 'Old Record', employee_id = null, is_date_verified = 0
  const txnInsert = queriesRun.find((q) => q.sql.includes("INSERT INTO transactions"));
  assert.ok(txnInsert, "Transaction must be inserted for Sold lot");
  // [id, customerId, paymentMethod, txnNotes, creditEmpId, creditAgentName, verifiedDateInput, isDateVerified, provenanceToSet]
  assert.equal(txnInsert.params[1], 999, "Transaction must link customer_id");
  assert.equal(txnInsert.params[4], null, "Old Record attribution must have employee_id = null");
  assert.equal(txnInsert.params[5], "Old Record", "Transaction agent_name must be 'Old Record'");
  assert.equal(txnInsert.params[7], 0, "is_date_verified must be 0 for legacy undated sale");
});

test("pending reservation with optional / omitted customer details succeeds and defaults safely", async () => {
  const { updateLotStatus } = require("../src/controllers/lots/lotStatusController");

  const queriesRun = [];
  let insertedCustomerId = null;
  const fakeConn = {
    query: async (sql, params) => {
      queriesRun.push({ sql, params });
      if (sql.includes("FROM lots WHERE lot_id = ?")) {
        return [[{ lot_id: 101, lot_number: "Block 1 Lot 101", status: "Available" }]];
      }
      if (sql.includes("FROM customers WHERE lot_id = ?") && sql.includes("ORDER BY updated_at DESC")) {
        return [[]];
      }
      if (sql.includes("FROM customers WHERE lot_id = ? ORDER BY customer_id DESC LIMIT 1")) {
        return [[{ customer_id: insertedCustomerId || 555 }]];
      }
      if (sql.includes("FROM transactions WHERE customer_id = ?")) {
        return [[]];
      }
      if (sql.includes("INSERT INTO customers")) {
        insertedCustomerId = 555;
        return [{ insertId: 555 }];
      }
      return [{ insertId: 777 }];
    },
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
  };
  const mockDbConn = {
    getConnection: async () => fakeConn,
    query: async (sql, params) => fakeConn.query(sql, params),
  };

  // Case 1: Pending reservation with ONLY full name (all contact/email/address omitted)
  const reqPartial = {
    params: { id: 101 },
    body: {
      status: "Pending",
      fullName: "Maria Clara",
    },
    user: { role: "employee", id: 2, email: "agent@example.com" },
    db: mockDbConn,
  };
  let statusCode = 200;
  const res = {
    status: (code) => { statusCode = code; return res; },
    json: () => {},
  };

  await updateLotStatus(reqPartial, res);
  assert.equal(statusCode, 200, "Pending reservation with partial info must succeed");

  const custInsert = queriesRun.find((q) => q.sql.includes("INSERT INTO customers"));
  assert.ok(custInsert, "Customer must be inserted for Pending lot");
  // VALUES [id, safeFullName, safeContact, safeEmail, safeAddress, employeeId, status]
  assert.equal(custInsert.params[1], "Maria Clara", "Provided full name must be preserved");
  assert.equal(custInsert.params[2], "To be updated", "Omitted contact number must safely default to 'To be updated'");
  assert.equal(custInsert.params[3], "To be updated", "Omitted email must safely default to 'To be updated'");
  assert.equal(custInsert.params[4], "To be updated", "Omitted address must safely default to 'To be updated'");
  assert.equal(custInsert.params[6], "Pending", "Customer status must be Pending");

  // Case 2: Pending reservation with missing / omitted full name must be rejected with 400
  queriesRun.length = 0;
  let errorResponse = null;
  const resFail = {
    status: (code) => { statusCode = code; return resFail; },
    json: (data) => { errorResponse = data; },
  };
  const reqEmpty = {
    params: { id: 101 },
    body: {
      status: "Pending",
      contactNumber: "09123456789",
    },
    user: { role: "employee", id: 2, email: "agent@example.com" },
    db: mockDbConn,
  };

  await updateLotStatus(reqEmpty, resFail);
  assert.equal(statusCode, 400, "Pending reservation without full name must be rejected with 400");
  assert.equal(errorResponse?.error, "Customer full name is required");
});
