const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {
  MAX_IMPORT_LOTS, MAX_POLYGON_VERTICES, OVERLAP_TOLERANCE_SQM,
  validateImport, validatePolygon, polygonKey, assertNoExistingDuplicates, assertNoOverlappingLots,
} = require("../src/utils/lotImportValidation");
const { createImportLotsHandler } = require("../src/controllers/lotImportController");

const square = (offset = 0) => [
  [10.67 + offset, 122.33], [10.6701 + offset, 122.33],
  [10.6701 + offset, 122.3301], [10.67 + offset, 122.3301],
];
const lot = (index = 1) => ({ lot_number: `B1 L${index}`, area_sqm: 120, coordinates: square(index / 1000) });
const request = (lots = [lot()]) => ({ property_id: 3, sourceName: "site-plan.pdf", lots });

test("validates reviewed lots, trims identifiers and converts a closed ring to an open one", () => {
  const candidate = lot();
  candidate.lot_number = "  B1   L1  ";
  candidate.coordinates.push([...candidate.coordinates[0]]);
  candidate.area_sqm = 120.126;
  const result = validateImport({ ...request([candidate]), property_id: "3" });
  assert.equal(result.property_id, 3);
  assert.equal(result.lots[0].lot_number, "B1 L1");
  assert.equal(result.lots[0].area_sqm, 120.13);
  assert.equal(result.lots[0].coordinates.length, 4);
  assert.equal(candidate.coordinates.length, 5, "input is not mutated");
});

test("rejects invalid property IDs, oversized/empty batches and invalid source names", () => {
  for (const property_id of [null, true, {}, 0, -1, 1.5, "1.5", "1e3", 2147483648]) {
    assert.throws(() => validateImport({ ...request(), property_id }), /property ID/);
  }
  assert.throws(() => validateImport(request([])), /between 1 and/);
  assert.throws(() => validateImport(request(Array(MAX_IMPORT_LOTS + 1).fill(lot()))), /between 1 and/);
  assert.throws(() => validateImport({ ...request(), sourceName: {} }), /filename/);
});

test("requires a bounded name and valid area for every selected lot", () => {
  for (const lot_number of [null, 123, " ", "x".repeat(51), "B1\nL1"]) {
    assert.throws(() => validateImport(request([{ ...lot(), lot_number }])), /identifier/);
  }
  for (const area_sqm of [null, "120", Infinity, NaN, 0, -1, 0.001, 100000000]) {
    assert.throws(() => validateImport(request([{ ...lot(), area_sqm }])), /area must be/);
  }
  assert.throws(() => validateImport(request([lot(), { ...lot(2), lot_number: " b1   l1 " }])), /Duplicate lot identifier/);
});

test("rejects malformed, degenerate and self-intersecting polygons", () => {
  const invalid = [
    null, [10, 122], [[10, 122], [11, 122]],
    [[10, 122], [91, 122], [11, 123]],
    [[10, 122], [11, 181], [11, 123]],
    [[10, 122], [11, NaN], [11, 123]],
    [[10, 122], ["11", 122], [11, 123]],
    [[10, 122], [11, 122, 9], [11, 123]],
    [[0, 0], [1, 1], [2, 2]],
    [[0, 0], [2, 2], [0, 2], [2, 0]],
    [[0, 0], [3, 2], [0, 3], [2, 0]], // Intersection with nonzero signed area.
    [[0, 0], [2, 0], [1, 0], [2, 2], [0, 2]], // Adjacent edge overlap.
    [[0, 0], [2, 0], [2, 2], [1, 0], [0, 2]], // Nonadjacent edge touch.
    [[0, 0], [1, 0], [1, 1], [1, 0], [0, 1]],
    Array(MAX_POLYGON_VERTICES + 2).fill([0, 0]),
  ];
  for (const coordinates of invalid) {
    assert.throws(() => validatePolygon(coordinates), undefined, JSON.stringify(coordinates));
  }
});

test("accepts a concave boundary and adjacent lots sharing edges", () => {
  assert.equal(validatePolygon([[0, 0], [2, 0], [2, 2], [1, 1], [0, 2]]).length, 5);
  const first = { ...lot(), coordinates: [[0, 0], [0, 1], [1, 1], [1, 0]] };
  const second = { ...lot(2), coordinates: [[1, 0], [1, 1], [2, 1], [2, 0]] };
  assert.equal(validateImport(request([first, second])).lots.length, 2);
});

const rectangle = (bottom, left, top, right) => [[bottom, left], [top, left], [top, right], [bottom, right]];
const candidates = (a, b) => [{ ...lot(), coordinates: a }, { ...lot(2), coordinates: b }];

test("rejects crossing, contained and partially overlapping selected polygons", () => {
  const cases = [
    [rectangle(-1, -3, 1, 3), rectangle(-3, -1, 3, 1)], // Crossing without contained vertices.
    [rectangle(0, 0, 3, 3), rectangle(1, 1, 2, 2)], // Entirely contained.
    [rectangle(0, 0, 2, 2), rectangle(0, 1, 2, 3)], // Vertices touch collinear edges.
    [rectangle(0, 0, 2, 2), rectangle(1, 1, 3, 3)],
    [[[0, 0], [0, 3], [1, 3], [1, 1], [3, 1], [3, 0]], rectangle(0.5, 0.5, 1.5, 1.5)],
  ];
  for (const [a, b] of cases) {
    assert.throws(() => validateImport(request(candidates(a, b))), /overlaps selected lot/);
    assert.throws(() => validateImport(request(candidates(b.slice().reverse(), a.slice().reverse()))), /overlaps selected lot/);
  }
});

test("permits disjoint polygons, shared vertices, shared edges and polygons outside a concave interior", () => {
  const cases = [
    [rectangle(0, 0, 1, 1), rectangle(2, 2, 3, 3)],
    [rectangle(0, 0, 1, 1), rectangle(1, 1, 2, 2)],
    [rectangle(0, 0, 1, 1), rectangle(1, 0, 2, 1)],
    [[[0, 0], [0, 3], [1, 3], [1, 1], [3, 1], [3, 0]], rectangle(1, 1, 2, 2)],
    [[[0, 0], [1, 1], [0, 2]], [[0, 0], [1, 1], [2, 0]]], // Diagonal shared edge.
  ];
  for (const [a, b] of cases) {
    assert.equal(validateImport(request(candidates(a, b))).lots.length, 2);
    assertNoExistingDuplicates([{ ...lot(), coordinates: a }], [{ lot_number: "Existing", coordinates: JSON.stringify(b) }]);
  }
});

test("overlap area tolerance ignores only tiny slivers at real subdivision coordinates", () => {
  const degree = Math.PI * 6371008.8 / 180;
  const latitude = 10.67;
  const metreLat = 1 / degree;
  const metreLng = 1 / (degree * Math.cos(latitude * Math.PI / 180));
  const first = rectangle(latitude, 122.33, latitude + 10 * metreLat, 122.33 + 10 * metreLng);
  for (const fraction of [0.1, 0.8, 1.2, 3]) {
    const overlapWidth = OVERLAP_TOLERANCE_SQM * fraction / 10;
    const second = rectangle(latitude, 122.33 + (10 - overlapWidth) * metreLng,
      latitude + 10 * metreLat, 122.33 + 20 * metreLng);
    if (fraction < 1) assertNoOverlappingLots(candidates(first, second));
    else assert.throws(() => assertNoOverlappingLots(candidates(first, second)), /overlaps selected lot/);
  }
});

test("identifies the same boundary despite starting vertex, orientation, closure and redundant points", () => {
  const base = [[10, 122], [11, 122], [11, 123], [10, 123]];
  const equivalent = [[11, 123], [11, 122], [10.5, 122], [10, 122], [10, 123], [11, 123]];
  assert.equal(polygonKey(base), polygonKey(equivalent));
  assert.throws(() => validateImport(request([
    { ...lot(), coordinates: base }, { ...lot(2), coordinates: equivalent },
  ])), /same boundary/);
  assert.throws(() => assertNoExistingDuplicates([{ ...lot(), coordinates: base }], [
    { lot_number: "Old identifier", coordinates: JSON.stringify(equivalent) },
  ]), /already exists/);
  assert.equal(polygonKey("malformed legacy coordinates"), null);
  assert.equal(polygonKey([10, 122]), null);
});

// No database module is required here. Each connection keeps uncommitted inserts
// isolated, and the property row lock queues concurrent transactions.
function mockDatabase({ existing = [], propertyExists = true, failInsertAt = 0 } = {}) {
  const rows = [...existing];
  const events = [];
  let nextId = 100;
  let lockTail = Promise.resolve();
  let connectionCount = 0;
  const pool = {
    async getConnection() {
      const id = ++connectionCount;
      let staged = [];
      let unlock;
      let inserts = 0;
      return {
        async beginTransaction() { events.push([id, "begin"]); },
        async query(sql, values) {
          events.push([id, "query", sql, values]);
          if (sql.startsWith("SELECT property_id")) {
            assert.match(sql, /FOR UPDATE$/);
            const preceding = lockTail;
            lockTail = new Promise((resolve) => { unlock = resolve; });
            await preceding;
            return [propertyExists ? [{ property_id: values[0] }] : []];
          }
          if (sql.startsWith("SELECT lot_id")) {
            assert.match(sql, /FOR UPDATE$/);
            return [[...rows]];
          }
          if (sql.startsWith("INSERT INTO lots")) {
            inserts++;
            if (inserts === failInsertAt) throw new Error("simulated storage failure");
            const [property_id, lot_number, area_sqm, status, coordinates] = values;
            const insertId = nextId++;
            staged.push({ lot_id: insertId, property_id, lot_number, area_sqm, status, coordinates });
            return [{ insertId }];
          }
          throw new Error(`Unexpected query: ${sql}`);
        },
        async commit() {
          events.push([id, "commit"]);
          rows.push(...staged);
          staged = [];
          unlock?.();
        },
        async rollback() { events.push([id, "rollback"]); staged = []; unlock?.(); },
        release() { events.push([id, "release"]); },
      };
    },
  };
  return { pool, rows, events, connections: () => connectionCount };
}

async function invoke(db, body = request()) {
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
  const handler = createImportLotsHandler({ getPool: () => db.pool, logger: { error() {} } });
  await handler({ body }, response);
  return response;
}

test("validates the whole request before acquiring a database connection", async () => {
  const db = mockDatabase();
  const response = await invoke(db, request([lot(), { ...lot(2), coordinates: [] }]));
  assert.equal(response.statusCode, 400);
  assert.equal(db.connections(), 0);
  assert.equal(db.rows.length, 0);
});

test("commits reviewed lots together with Available status and exact inserted IDs", async () => {
  const db = mockDatabase();
  const response = await invoke(db, request([{ ...lot(), status: "Sold" }, lot(2)]));
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.createdCount, 2);
  assert.deepEqual(response.body.lots.map((entry) => entry.lot_id), [100, 101]);
  assert.ok(response.body.lots.every((entry) => entry.status === "Available" && entry.property_id === 3));
  assert.deepEqual(JSON.parse(db.rows[0].coordinates), lot().coordinates);
  assert.equal(db.events.filter((entry) => entry[1] === "commit").length, 1);
  assert.equal(db.events.at(-1)[1], "release");
});

test("missing property rolls back and releases its connection", async () => {
  const db = mockDatabase({ propertyExists: false });
  const response = await invoke(db);
  assert.equal(response.statusCode, 404);
  assert.equal(db.rows.length, 0);
  assert.deepEqual(db.events.slice(-2).map((entry) => entry[1]), ["rollback", "release"]);
});

test("a failing later insert rolls back every earlier inserted lot", async () => {
  const db = mockDatabase({ failInsertAt: 2 });
  const response = await invoke(db, request([lot(), lot(2)]));
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.success, false);
  assert.equal(db.rows.length, 0);
  assert.ok(!response.body.error.includes("simulated"), "database internals are not sent to the client");
  assert.deepEqual(db.events.slice(-2).map((entry) => entry[1]), ["rollback", "release"]);
});

test("an existing identifier or polygon rejects the entire batch without any inserts", async () => {
  for (const existing of [
    [{ lot_number: " b1 l2 ", coordinates: null }],
    [{ lot_number: "Original lot", coordinates: JSON.stringify(lot(2).coordinates.slice().reverse()) }],
  ]) {
    const db = mockDatabase({ existing });
    const response = await invoke(db, request([lot(), lot(2)]));
    assert.equal(response.statusCode, 409);
    assert.equal(db.rows.length, 1);
    assert.ok(!db.events.some((entry) => entry[2]?.startsWith("INSERT")));
    assert.deepEqual(db.events.slice(-2).map((entry) => entry[1]), ["rollback", "release"]);
  }
});

test("existing lot interior overlap rejects the entire transaction before any insert", async () => {
  const selected = lot(2);
  const moved = selected.coordinates.map(([lat, lng]) => [lat + 0.00003, lng + 0.00003]);
  const db = mockDatabase({ existing: [{ lot_id: 7, lot_number: "Old lot", coordinates: JSON.stringify(moved) }] });
  const response = await invoke(db, request([lot(), selected]));
  assert.equal(response.statusCode, 409);
  assert.match(response.body.error, /overlaps existing lot Old lot/);
  assert.equal(db.rows.length, 1);
  assert.ok(!db.events.some((entry) => entry[2]?.startsWith("INSERT")));
  assert.deepEqual(db.events.slice(-2).map((entry) => entry[1]), ["rollback", "release"]);
});

test("overlapping selected lots never acquire a database connection", async () => {
  const db = mockDatabase();
  const response = await invoke(db, request(candidates(rectangle(0, 0, 2, 2), rectangle(1, 1, 3, 3))));
  assert.equal(response.statusCode, 400);
  assert.equal(db.connections(), 0);
});

test("retries and simultaneous imports cannot create the same lots twice", async () => {
  const db = mockDatabase();
  const responses = await Promise.all([invoke(db), invoke(db)]);
  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [201, 409]);
  assert.equal(db.rows.length, 1);
  const retry = await invoke(db, request([{ ...lot(), lot_number: "Renamed on retry" }]));
  assert.equal(retry.statusCode, 409);
  assert.equal(db.rows.length, 1);
});

test("a pool acquisition failure gives a controlled error without starting a transaction", async () => {
  const response = await invoke({ pool: { async getConnection() { throw new Error("offline"); } } });
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.success, false);
});

function loadWithMocks(filename, mocks) {
  const module = { exports: {} };
  const factory = vm.runInNewContext(`(function(require, module, exports, __dirname) {\n${fs.readFileSync(filename, "utf8")}\n})`, {
    console: { warn() {}, error() {} }, process: { env: {} },
  }, { filename });
  factory((name) => {
    if (!(name in mocks)) throw new Error(`Unexpected dependency in isolated route test: ${name}`);
    return mocks[name];
  }, module, module.exports, path.dirname(filename));
  return module.exports;
}

test("the real import route uses session authentication and allows only administrators", async () => {
  const sessionOrToken = loadWithMocks(path.resolve(__dirname, "../src/middleware/session_or_token.js"), {
    jsonwebtoken: { verify() { throw new Error("No tokens used by this test"); } },
    fs: { existsSync: () => false }, path,
    "../services/sessionManager": { isValidSession: async () => true },
  });
  const registered = [];
  const router = Object.fromEntries(["get", "post", "put", "delete"].map((method) => [method,
    (route, ...handlers) => registered.push({ method, route, handlers }),
  ]));
  let imports = 0;
  loadWithMocks(path.resolve(__dirname, "../src/routes/lotRoutes.js"), {
    express: { Router: () => router },
    "../middleware/session_or_token": sessionOrToken,
    "../controllers/lotImportController": { importLots: async (req, res) => {
      imports++;
      return res.status(201).json({ success: true });
    } },
    "../controllers/lotsController": new Proxy({}, { get: () => () => {} }),
  });
  const route = registered.find((entry) => entry.method === "post" && entry.route === "/import");
  assert.ok(route);
  assert.equal(route.handlers.length, 2);
  for (const [role, expectedStatus] of [[null, 401], ["employee", 403], ["admin", 201]]) {
    const req = {
      headers: { accept: "application/json" }, method: "POST", originalUrl: "/api/lots/import",
      session: role ? { user: { id: 1, role } } : undefined,
    };
    const res = { statusCode: 200, status(value) { this.statusCode = value; return this; },
      json(value) { this.body = value; return this; } };
    await route.handlers[0](req, res, () => route.handlers[1](req, res));
    assert.equal(res.statusCode, expectedStatus, role || "anonymous");
  }
  assert.equal(imports, 1, "only the administrator reaches the import handler");
});
