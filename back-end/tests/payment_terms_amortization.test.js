const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

test("Payment terms & monthly amortization in getLotById and getMapData", async (t) => {
  const dbPath = require.resolve("../config/database_connection");
  const previousDb = require.cache[dbPath];

  const fakeDb = {
    query: async (sql, params) => {
      if (sql.includes("FROM lots WHERE lot_id = ?")) {
        return [[{ lot_id: 1, lot_number: "Block 1 Lot 1", status: "Sold", sold_on: "2026-05-10" }]];
      }
      if (sql.includes("FROM customers WHERE lot_id = ?")) {
        return [[{ customer_id: 10, full_name: "Juan Dela Cruz", employee_id: 2 }]];
      }
      if (sql.includes("FROM transactions t")) {
        return [[{
          payment_type: "Installment",
          total_contract_price: "600000.00",
          downpayment: "120000.00",
          terms_months: 24,
          monthly_amortization: "20000.00",
          employee_id: 2,
          agent_name: "Agent Two",
          agent_status: "active",
        }]];
      }
      if (sql.includes("FROM properties")) {
        return [[{ property_id: 1, property_name: "Golden Dragon Estate", total_lots: 10 }]];
      }
      if (sql.includes("FROM lots l")) {
        return [[{
          lot_id: 1,
          property_id: 1,
          lot_number: "Block 1 Lot 1",
          area_sqm: 100,
          status: "Sold",
          is_non_saleable: 0,
          coordinates: null,
          sold_on: "2026-05-10",
          customer_name: "Juan Dela Cruz",
          payment_method: "Installment",
          total_contract_price: "600000.00",
          downpayment: "120000.00",
          terms_months: 24,
          monthly_amortization: "20000.00",
          agent_name: "Agent Two",
          agent_status: "active",
        }]];
      }
      if (sql.includes("SELECT lot_id, lot_number, status, is_non_saleable")) {
        return [[{ lot_id: 1, lot_number: "Block 1 Lot 1", status: "Sold", is_non_saleable: 0, has_coordinates: 0 }]];
      }
      return [[]];
    },
  };

  require.cache[dbPath] = { exports: fakeDb };

  try {
    delete require.cache[require.resolve("../src/controllers/lotsController")];
    const { getLotById, getMapData } = require("../src/controllers/lotsController");

    // 1. Test getLotById returns parsed numeric pricing fields
    const mockRes1 = {
      json: (data) => data,
      status: () => mockRes1,
    };
    let lotResult = null;
    mockRes1.json = (data) => {
      lotResult = data;
      return data;
    };

    await getLotById({ params: { id: "1" } }, mockRes1);

    assert.equal(lotResult.payment_method, "Installment");
    assert.equal(lotResult.total_contract_price, 600000);
    assert.equal(lotResult.downpayment, 120000);
    assert.equal(lotResult.terms_months, 24);
    assert.equal(lotResult.monthly_amortization, 20000);

    // 2. Test getMapData returns pricing fields and payment_method in lot objects
    let mapDataResult = null;
    const mockRes2 = {
      json: (data) => {
        mapDataResult = data;
        return data;
      },
      status: () => mockRes2,
    };

    await getMapData({}, mockRes2);

    assert.ok(mapDataResult.lots.length > 0);
    const mapLot = mapDataResult.lots[0];
    assert.equal(mapLot.payment_method, "Installment");
    assert.equal(mapLot.total_contract_price, 600000);
    assert.equal(mapLot.downpayment, 120000);
    assert.equal(mapLot.terms_months, 24);
    assert.equal(mapLot.monthly_amortization, 20000);

    // 3. Test getLotById for a Pending reservation preserves payment_method
    let pendingLotResult = null;
    const mockRes3 = {
      json: (data) => {
        pendingLotResult = data;
        return data;
      },
      status: () => mockRes3,
    };
    fakeDb.query = async (sql) => {
      if (sql.includes("FROM lots WHERE lot_id = ?")) {
        return [[{ lot_id: 2, lot_number: "Block 1 Lot 2", status: "Pending", pending_since: "2026-05-10" }]];
      }
      if (sql.includes("FROM customers WHERE lot_id = ?")) {
        return [[{ customer_id: 11, full_name: "Pedro Penduko", employee_id: 2 }]];
      }
      if (sql.includes("FROM transactions t")) {
        return [[{
          payment_type: "Installment",
          total_contract_price: "450000.00",
          downpayment: "50000.00",
          terms_months: 12,
          monthly_amortization: "33333.33",
          employee_id: 2,
          agent_name: "Agent Two",
          agent_status: "active",
        }]];
      }
      return [[]];
    };
    await getLotById({ params: { id: "2" } }, mockRes3);
    assert.equal(pendingLotResult.payment_method, "Installment");
    assert.equal(pendingLotResult.total_contract_price, 450000);
    assert.equal(pendingLotResult.terms_months, 12);
  } finally {
    if (previousDb) {
      require.cache[dbPath] = previousDb;
    } else {
      delete require.cache[dbPath];
    }
    delete require.cache[require.resolve("../src/controllers/lotsController")];
  }
});

test("Monthly amortization formula (TCP - DP) / Terms auto-calculation", () => {
  const computeAmortization = (tcp, dp, terms) => {
    const cleanTcp = parseFloat(tcp);
    const cleanDp = dp ? parseFloat(dp) : 0;
    const cleanTerms = parseInt(terms, 10);

    if (isNaN(cleanTcp) || isNaN(cleanTerms) || cleanTerms <= 0) return 0;
    const balance = cleanTcp - cleanDp;
    if (balance <= 0) return 0;
    return Number((balance / cleanTerms).toFixed(2));
  };

  // Example 1: 500k TCP, 100k DP, 24 months = 16,666.67
  assert.equal(computeAmortization(500000, 100000, 24), 16666.67);

  // Example 2: 600k TCP, 120k DP, 24 months = 20,000.00
  assert.equal(computeAmortization(600000, 120000, 24), 20000);

  // Example 3: 1,000,000 TCP, 0 DP, 60 months = 16,666.67
  assert.equal(computeAmortization(1000000, 0, 60), 16666.67);

  // Edge cases: Terms 0 or negative -> 0
  assert.equal(computeAmortization(500000, 100000, 0), 0);
  assert.equal(computeAmortization(500000, 100000, -5), 0);

  // Edge case: DP >= TCP -> 0
  assert.equal(computeAmortization(500000, 500000, 24), 0);
  assert.equal(computeAmortization(500000, 600000, 24), 0);
});
