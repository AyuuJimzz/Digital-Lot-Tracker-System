const assert = require("node:assert/strict");
const test = require("node:test");
const { inspectDatabase } = require("../scripts/production_preflight");

const schema = {
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

test("preflight uses only reads and reports schema and inventory risks", async () => {
  const queries = [];
  const database = {
    query: async (sql) => {
      queries.push(sql);
      if (sql.includes("INFORMATION_SCHEMA")) {
        return [Object.entries(schema).flatMap(([TABLE_NAME, fields]) =>
          fields.map((COLUMN_NAME) => ({ TABLE_NAME, COLUMN_NAME })),
        )];
      }
      if (sql.includes("FROM lots")) {
        return [[{ non_saleable_reserved_or_sold: 0, undated_sold_lots: 2 }]];
      }
      return [[{ invalid_verified_dates: 0, verified_reversals: 0 }]];
    },
  };
  const ready = await inspectDatabase(database);
  assert.equal(ready.ready, true);
  assert.equal(ready.counts.undated_sold_lots, 2);
  assert.equal(queries.length, 3);
  assert(queries.every((sql) => /^\s*SELECT\b/i.test(sql)));

  delete schema.lots;
  try {
    const missing = await inspectDatabase(database);
    assert.equal(missing.ready, false);
    assert.deepEqual(missing.missingSchema, ["table lots"]);
  } finally {
    schema.lots = ["lot_id", "property_id", "status", "is_non_saleable", "sold_on"];
  }
});
