const test = require("node:test");
const assert = require("node:assert/strict");

test("subdivision colors persistence controller functions", async (t) => {
  const dbPath = require.resolve("../config/database_connection");
  const previousDb = require.cache[dbPath];

  let currentDb = null;
  const proxyDb = {
    query: async (...args) => currentDb.query(...args),
  };

  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: proxyDb };
  delete require.cache[require.resolve("../src/controllers/lots/lotAnalyticsController")];
  delete require.cache[require.resolve("../src/controllers/lotsController")];

  const {
    getSubdivisionColors,
    saveSubdivisionColors,
    resetSubdivisionColors,
  } = require("../src/controllers/lots/lotAnalyticsController");

  try {
    await t.test("getSubdivisionColors returns empty colors object when state is not set", async () => {
      let queriedSql = "";
      currentDb = {
        query: async (sql) => {
          queriedSql = sql;
          return [[]];
        },
      };

      let responseData = null;
      const req = { db: currentDb };
      const res = {
        json: (data) => {
          responseData = data;
          return res;
        },
        status: () => res,
      };

      await getSubdivisionColors(req, res);
      assert.match(queriedSql, /subdivision_chart_colors/);
      assert.deepEqual(responseData, { colors: {} });
    });

    await t.test("getSubdivisionColors returns parsed colors object when state exists", async () => {
      const mockColors = { "2018": "#f43f5e", "3896": "#06b6d4" };
      currentDb = {
        query: async () => [
          [{ state_value: JSON.stringify(mockColors) }],
        ],
      };

      let responseData = null;
      const req = { db: currentDb };
      const res = {
        json: (data) => {
          responseData = data;
          return res;
        },
        status: () => res,
      };

      await getSubdivisionColors(req, res);
      assert.deepEqual(responseData, { colors: mockColors });
    });

    await t.test("saveSubdivisionColors sanitizes valid hex and writes to system_state", async () => {
      let executedSql = "";
      let executedParams = [];
      currentDb = {
        query: async (sql, params) => {
          executedSql = sql;
          executedParams = params;
          return [{ affectedRows: 1 }];
        },
      };

      let responseData = null;
      const req = {
        db: currentDb,
        body: {
          colors: {
            "2018": "f43f5e",
            "3896": "#06B6D4",
            "invalid": "blue-not-hex",
          },
        },
      };
      const res = {
        json: (data) => {
          responseData = data;
          return res;
        },
        status: () => res,
      };

      await saveSubdivisionColors(req, res);
      assert.match(executedSql, /INSERT INTO system_state/);
      assert.match(executedSql, /ON DUPLICATE KEY UPDATE/);
      assert.equal(responseData.success, true);
      assert.deepEqual(responseData.colors, {
        "2018": "#f43f5e",
        "3896": "#06b6d4",
      });
      assert.equal(executedParams[0], JSON.stringify({ "2018": "#f43f5e", "3896": "#06b6d4" }));
    });

    await t.test("resetSubdivisionColors deletes subdivision_chart_colors from system_state", async () => {
      let executedSql = "";
      currentDb = {
        query: async (sql) => {
          executedSql = sql;
          return [{ affectedRows: 1 }];
        },
      };

      let responseData = null;
      const req = { db: currentDb };
      const res = {
        json: (data) => {
          responseData = data;
          return res;
        },
        status: () => res,
      };

      await resetSubdivisionColors(req, res);
      assert.match(executedSql, /DELETE FROM system_state WHERE state_key = 'subdivision_chart_colors'/);
      assert.deepEqual(responseData, { success: true, reset: true });
    });
  } finally {
    if (previousDb) {
      require.cache[dbPath] = previousDb;
    } else {
      delete require.cache[dbPath];
    }
  }
});
