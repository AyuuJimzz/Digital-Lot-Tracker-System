const test = require("node:test");
const assert = require("node:assert/strict");
const { getDashboardStats } = require("../src/controllers/lots/lotAnalyticsController");

function createMockResponse() {
  let statusCode = 200;
  let jsonResult = null;
  return {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonResult = data;
      return this;
    },
    getStatusCode() {
      return statusCode;
    },
    getResult() {
      return jsonResult;
    },
  };
}

test("getDashboardStats returns estate-wide totals and subdivisions array when property_id is not specified", async () => {
  const mockLots = [
    { lot_id: 1, property_id: 10, lot_number: "Block 1 Lot 1", status: "Available", is_non_saleable: 0 },
    { lot_id: 2, property_id: 10, lot_number: "Block 1 Lot 2", status: "Sold", is_non_saleable: 0 },
    { lot_id: 3, property_id: 20, lot_number: "Block 1 Lot 1", status: "Pending", is_non_saleable: 0 },
    { lot_id: 4, property_id: 20, lot_number: "Open Space", status: "Available", is_non_saleable: 1 },
  ];

  const mockProps = [
    { property_id: 10, property_name: "Abilay Norte", location: "Oton, Iloilo", total_lots: 2 },
    { property_id: 20, property_name: "Pulo Maestra", location: "Oton, Iloilo", total_lots: 2 },
  ];

  const mockDb = {
    query: async (sql, params) => {
      if (sql.includes("FROM lots")) {
        return [mockLots];
      }
      if (sql.includes("FROM properties")) {
        return [mockProps];
      }
      if (sql.includes("FROM customers")) {
        return [[{ count: 5 }]];
      }
      return [[]];
    },
  };

  const req = { query: {}, db: mockDb };
  const res = createMockResponse();

  await getDashboardStats(req, res);

  assert.equal(res.getStatusCode(), 200);
  const data = res.getResult();
  assert.equal(data.propertyId, "all");
  assert.equal(data.propertyName, "All Projects (Whole Estate)");
  assert.equal(data.placeLocation, "Iloilo City");
  assert.equal(data.totalParcels, 4);
  assert.equal(data.nonSaleableLots, 1);
  assert.equal(data.totalLots, 3); // 4 - 1
  assert.equal(data.availableLots, 1);
  assert.equal(data.soldLots, 1);
  assert.equal(data.pendingLots, 1);
  assert.equal(data.totalClients, 5);
  assert.equal(data.subdivisions.length, 2);

  const sub10 = data.subdivisions.find((s) => s.property_id === 10);
  assert.equal(sub10.totalLots, 2);
  assert.equal(sub10.availableLots, 1);
  assert.equal(sub10.soldLots, 1);

  const sub20 = data.subdivisions.find((s) => s.property_id === 20);
  assert.equal(sub20.totalLots, 1);
  assert.equal(sub20.availableLots, 0);
  assert.equal(sub20.pendingLots, 1);
  assert.equal(sub20.nonSaleableLots, 1);
});

test("getDashboardStats correctly filters by specific property_id", async () => {
  const mockLots = [
    { lot_id: 1, property_id: 10, lot_number: "Block 1 Lot 1", status: "Available", is_non_saleable: 0 },
    { lot_id: 2, property_id: 10, lot_number: "Block 1 Lot 2", status: "Sold", is_non_saleable: 0 },
    { lot_id: 3, property_id: 20, lot_number: "Block 1 Lot 1", status: "Pending", is_non_saleable: 0 },
  ];

  const mockProps = [
    { property_id: 10, property_name: "Abilay Norte", location: "Brgy. Abilay, Oton", total_lots: 2 },
    { property_id: 20, property_name: "Pulo Maestra", location: "Brgy. Pulo, Oton", total_lots: 1 },
  ];

  let passedCustomerParams = null;
  const mockDb = {
    query: async (sql, params) => {
      if (sql.includes("FROM lots")) {
        return [mockLots];
      }
      if (sql.includes("FROM properties")) {
        return [mockProps];
      }
      if (sql.includes("FROM customers")) {
        passedCustomerParams = params;
        return [[{ count: 2 }]];
      }
      return [[]];
    },
  };

  const req = { query: { property_id: "10" }, db: mockDb };
  const res = createMockResponse();

  await getDashboardStats(req, res);

  assert.equal(res.getStatusCode(), 200);
  const data = res.getResult();
  assert.equal(data.propertyId, 10);
  assert.equal(data.propertyName, "Abilay Norte");
  assert.equal(data.placeLocation, "Brgy. Abilay, Oton");
  assert.equal(data.totalLots, 2);
  assert.equal(data.availableLots, 1);
  assert.equal(data.soldLots, 1);
  assert.equal(data.pendingLots, 0);
  assert.equal(data.totalClients, 2);
  assert.deepEqual(passedCustomerParams, [10]);
});

test("getDashboardStats handles non-existent property_id gracefully without crashing", async () => {
  const mockLots = [
    { lot_id: 1, property_id: 10, lot_number: "Block 1 Lot 1", status: "Available", is_non_saleable: 0 },
  ];
  const mockProps = [
    { property_id: 10, property_name: "Abilay Norte", location: "Brgy. Abilay, Oton", total_lots: 1 },
  ];

  const mockDb = {
    query: async (sql, params) => {
      if (sql.includes("FROM lots")) return [mockLots];
      if (sql.includes("FROM properties")) return [mockProps];
      if (sql.includes("FROM customers")) return [[{ count: 0 }]];
      return [[]];
    },
  };

  const req = { query: { property_id: "999" }, db: mockDb };
  const res = createMockResponse();

  await getDashboardStats(req, res);

  assert.equal(res.getStatusCode(), 200);
  const data = res.getResult();
  assert.equal(data.propertyId, 999);
  assert.equal(data.propertyName, "All Projects (Whole Estate)");
  assert.equal(data.placeLocation, "Iloilo City");
  assert.equal(data.totalLots, 0);
  assert.equal(data.availableLots, 0);
  assert.equal(data.soldLots, 0);
  assert.equal(data.pendingLots, 0);
  assert.equal(data.totalClients, 0);
});

test("getTransactions includes p.property_id in the SELECT query", async () => {
  const { getTransactions } = require("../src/controllers/transactionsController");
  let executedSql = "";
  const mockDb = {
    execute: async (sql, params) => {
      executedSql = sql;
      return [[
        { transaction_id: "TXN-0001", lot_id: 1, property_id: 10, property_name: "Abilay Norte", lot_number: "Block 1 Lot 1" }
      ]];
    }
  };

  const req = { query: {}, db: mockDb };
  const res = createMockResponse();

  await getTransactions(req, res);

  assert.equal(res.getStatusCode(), 200);
  assert.equal(executedSql.includes("p.property_id"), true, "Query must select p.property_id");
  const data = res.getResult();
  assert.equal(Array.isArray(data), true);
  assert.equal(data[0].property_id, 10);
});
