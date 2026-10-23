const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("monthly sales sheet API is restricted to admins and enforces 403 for employees", async () => {
  const routesSource = fs.readFileSync(
    path.join(__dirname, "../src/routes/lotRoutes.js"),
    "utf8"
  );

  assert.match(
    routesSource,
    /router\.get\("\/monthly-sales-sheet",\s*requireAdmin,\s*getMonthlySalesSheet\)/
  );

  const dbPath = require.resolve("../config/database_connection");
  const previousDb = require.cache[dbPath];
  let currentDb = {
    query: async (sql) => {
      if (sql && sql.includes("employees")) {
        return [[{ active_session_id: "sess-emp-1", status: "active" }]];
      }
      if (sql && sql.includes("admins")) {
        return [[{ active_session_id: "sess-adm-1" }]];
      }
      return [[]];
    },
  };
  const proxyDb = {
    query: async (...args) => currentDb.query(...args),
  };
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: proxyDb };

  delete require.cache[require.resolve("../src/services/sessionManager")];
  delete require.cache[require.resolve("../src/middleware/session_or_token")];
  const sessionOrToken = require("../src/middleware/session_or_token");
  const requireAdmin = sessionOrToken({ roles: ["admin"] });

  try {
    // 1. Unauthenticated request -> 401
    let unauthStatus = null;
    const unauthReq = { headers: {} };
    const unauthRes = {
      status: (code) => {
        unauthStatus = code;
        return { json: () => {} };
      },
    };
    await requireAdmin(unauthReq, unauthRes, () => {
      assert.fail("Should not invoke next() for unauthenticated requests");
    });
    assert.equal(unauthStatus, 401);

    // 2. Employee request -> 403 Forbidden
    let employeeStatus = null;
    let employeeJson = null;
    const employeeReq = {
      headers: {},
      session: {
        user: { role: "employee", id: 10, sessionId: "sess-emp-1" },
      },
    };
    const employeeRes = {
      status: (code) => {
        employeeStatus = code;
        return {
          json: (data) => {
            employeeJson = data;
          },
        };
      },
    };
    await requireAdmin(employeeReq, employeeRes, () => {
      assert.fail("Should not invoke next() for employee requests");
    });
    assert.equal(employeeStatus, 403);
    assert.match(employeeJson.message, /Forbidden/i);

    // 3. Admin request -> calls next()
    let nextCalled = false;
    const adminReq = {
      headers: {},
      session: {
        user: { role: "admin", id: 1, sessionId: "sess-adm-1" },
      },
    };
    const adminRes = {
      status: () => adminRes,
      json: () => adminRes,
    };
    await requireAdmin(adminReq, adminRes, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  } finally {
    if (previousDb) {
      require.cache[dbPath] = previousDb;
    } else {
      delete require.cache[dbPath];
    }
    delete require.cache[require.resolve("../src/services/sessionManager")];
    delete require.cache[require.resolve("../src/middleware/session_or_token")];
  }
});

test("monthly sales sheet controller functions", async (t) => {
  const dbPath = require.resolve("../config/database_connection");
  const previousDb = require.cache[dbPath];

  let currentDb = null;
  const proxyDb = {
    query: async (...args) => currentDb.query(...args),
  };

  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: proxyDb };
  delete require.cache[require.resolve("../src/controllers/lots/lotAnalyticsController")];
  delete require.cache[require.resolve("../src/controllers/lotsController")];

  const { getMonthlySalesSheet } = require("../src/controllers/lots/lotAnalyticsController");

  try {
    await t.test("getMonthlySalesSheet parses records, groups by project, and computes subtotals and grand totals", async () => {
      currentDb = {
        query: async (sql, params) => {
          assert.equal(params[0], 2026);
          assert.equal(params[1], 3);
          return [
            [
              {
                transaction_id: 101,
                purchase_date: "2026-03-06T08:00:00.000Z",
                payment_type: "DP & 1st monthly payment",
                total_contract_price: "1120000.00",
                downpayment: "20000.00",
                monthly_amortization: "6666.66",
                terms_months: 24,
                notes: null,
                agent_name: "Agent Maria",
                lot_id: 1,
                lot_number: "Block 2 Lot 14",
                lot_status: "Sold",
                property_id: 49,
                property_name: "Abilay",
                customer_id: 10,
                customer_name: "Juan Dela Cruz",
              },
              {
                transaction_id: 102,
                purchase_date: "2026-03-06T09:00:00.000Z",
                payment_type: "DOWNPAYMENT",
                total_contract_price: "1120000.00",
                downpayment: "20000.00",
                monthly_amortization: null,
                terms_months: null,
                notes: null,
                agent_name: "Agent Maria",
                lot_id: 2,
                lot_number: "Block 2 Lot 1",
                lot_status: "Sold",
                property_id: 49,
                property_name: "Abilay",
                customer_id: 11,
                customer_name: "Ana Santos",
              },
              {
                transaction_id: 103,
                purchase_date: "2026-03-16T10:00:00.000Z",
                payment_type: "STRAIGHT MONTHLY",
                total_contract_price: "520000.00",
                downpayment: "0.00",
                monthly_amortization: "6181.00",
                terms_months: 60,
                notes: null,
                agent_name: "Agent John",
                lot_id: 3,
                lot_number: "Blk 13 Lot 14",
                lot_status: "Sold",
                property_id: 50,
                property_name: "Pavia",
                customer_id: 12,
                customer_name: "Pedro Reyes",
              },
            ],
          ];
        },
      };

      let responseData = null;
      const req = {
        db: currentDb,
        query: { year: "2026", month: "3" },
      };
      const res = {
        json: (data) => {
          responseData = data;
          return res;
        },
        status: () => res,
      };

      await getMonthlySalesSheet(req, res);

      assert.equal(responseData.year, 2026);
      assert.equal(responseData.month, 3);
      assert.equal(responseData.projects.length, 2);

      // Verify Project 1: Abilay
      const abilay = responseData.projects[0];
      assert.equal(abilay.property_name, "Abilay");
      assert.equal(abilay.subtotal.lots_sold, 2);
      assert.equal(abilay.subtotal.total_tcp, 2240000);
      assert.equal(abilay.subtotal.total_amount, 46666.66); // 26666.66 + 20000

      const item1 = abilay.records[0];
      assert.equal(item1.buyer, "Juan Dela Cruz");
      assert.equal(item1.block, "2");
      assert.equal(item1.lot, "14");
      assert.equal(item1.amount, 26666.66);
      assert.equal(item1.tcp, 1120000);
      assert.equal(item1.agent, "Agent Maria");

      // Verify Project 2: Pavia
      const pavia = responseData.projects[1];
      assert.equal(pavia.property_name, "Pavia");
      assert.equal(pavia.subtotal.lots_sold, 1);
      assert.equal(pavia.subtotal.total_tcp, 520000);
      assert.equal(pavia.subtotal.total_amount, 6181);

      const paviaItem = pavia.records[0];
      assert.equal(paviaItem.block, "13");
      assert.equal(paviaItem.lot, "14");

      // Verify Overall Summary
      assert.equal(responseData.summary.total_lots_sold, 3);
      assert.equal(responseData.summary.overall_amount, 52847.66);
      assert.equal(responseData.summary.overall_tcp, 2760000);
      assert.equal(responseData.summary.project_summaries.length, 2);
    });

    await t.test("getMonthlySalesSheet handles empty month gracefully", async () => {
      currentDb = {
        query: async () => [[]],
      };

      let responseData = null;
      const req = {
        db: currentDb,
        query: { year: "2026", month: "1" },
      };
      const res = {
        json: (data) => {
          responseData = data;
          return res;
        },
        status: () => res,
      };

      await getMonthlySalesSheet(req, res);
      assert.equal(responseData.projects.length, 0);
      assert.equal(responseData.summary.total_lots_sold, 0);
      assert.equal(responseData.summary.overall_amount, 0);
      assert.equal(responseData.summary.overall_tcp, 0);
    });
  } finally {
    if (previousDb) {
      require.cache[dbPath] = previousDb;
    } else {
      delete require.cache[dbPath];
    }
  }
});
