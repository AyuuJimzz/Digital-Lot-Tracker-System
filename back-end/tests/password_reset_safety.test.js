const assert = require("node:assert/strict");
const test = require("node:test");

test("temporary password reset preserves the previous password when email fails", async () => {
  const events = [];
  const dbPath = require.resolve("../config/database_connection");
  const emailPath = require.resolve("../src/services/emailService");
  const controllerPath = require.resolve("../src/controllers/passwordResetController");
  const previousDb = require.cache[dbPath];
  const previousEmail = require.cache[emailPath];
  const previousController = require.cache[controllerPath];

  const connection = {
    beginTransaction: async () => events.push("begin"),
    query: async () => {
      events.push("update");
      return [{ affectedRows: 1 }];
    },
    rollback: async () => events.push("rollback"),
    commit: async () => events.push("commit"),
    release: () => events.push("release"),
  };
  const fakeDb = {
    query: async () => [[{ admin_id: 1, email: "user@example.com", full_name: "Test User" }]],
    getConnection: async () => connection,
  };
  let emailSucceeds = false;

  try {
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakeDb };
    require.cache[emailPath] = {
      id: emailPath,
      filename: emailPath,
      loaded: true,
      exports: {
        sendEmail: async (_to, _subject, html) => {
          events.push("email");
          assert.match(html, /[A-Za-z0-9]{16}/);
          return { success: emailSucceeds };
        },
      },
    };
    delete require.cache[controllerPath];
    const { forgotPassword } = require(controllerPath);
    const makeResponse = () => ({
      code: 200,
      status(code) { this.code = code; return this; },
      json(body) { this.body = body; return this; },
    });

    const failedResponse = makeResponse();
    await forgotPassword({ body: { email: "user@example.com" } }, failedResponse);
    assert.equal(failedResponse.code, 500);
    assert.deepEqual(events, ["begin", "update", "email", "rollback", "release"]);

    events.length = 0;
    emailSucceeds = true;
    const successfulResponse = makeResponse();
    await forgotPassword({ body: { email: "user@example.com" } }, successfulResponse);
    assert.equal(successfulResponse.code, 200);
    assert.deepEqual(events, ["begin", "update", "email", "commit", "release"]);
  } finally {
    if (previousDb) require.cache[dbPath] = previousDb;
    else delete require.cache[dbPath];
    if (previousEmail) require.cache[emailPath] = previousEmail;
    else delete require.cache[emailPath];
    if (previousController) require.cache[controllerPath] = previousController;
    else delete require.cache[controllerPath];
  }
});

test("resetPassword updates database and returns refreshed JWT with password_reset_required: false", async () => {
  const jwt = require("jsonwebtoken");
  const controllerPath = require.resolve("../src/controllers/passwordResetController");
  const dbPath = require.resolve("../config/database_connection");
  const previousDb = require.cache[dbPath];
  const previousController = require.cache[controllerPath];

  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-12345";

  let executedQuery = null;
  let queryParams = [];
  const fakeDb = {
    query: async (sql, params) => {
      executedQuery = sql;
      queryParams = params;
      return [{ affectedRows: 1 }];
    },
  };

  try {
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakeDb };
    delete require.cache[controllerPath];
    const { resetPassword } = require(controllerPath);

    const req = {
      body: {
        newPassword: "NewSecretPassword123!",
        confirmPassword: "NewSecretPassword123!",
      },
      user: {
        id: 42,
        email: "employee@goldendragon.com",
        role: "employee",
        sessionId: "session_abc123",
        password_reset_required: true,
      },
      session: {
        user: { password_reset_required: true },
      },
    };

    let responseData = null;
    let statusCode = 200;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
    };

    await resetPassword(req, res);

    assert.equal(statusCode, 200);
    assert.equal(responseData.password_reset_required, false);
    assert.equal(req.session.user.password_reset_required, false);
    assert.ok(responseData.token, "Must return a refreshed JWT token");

    // Verify database query updated password_reset_required to false
    assert.match(executedQuery, /UPDATE employees SET password = \?, password_reset_required = FALSE/);
    assert.equal(queryParams[1], 42);

    // Verify token payload has password_reset_required: false
    const decoded = jwt.verify(responseData.token, process.env.JWT_SECRET);
    assert.equal(decoded.id, 42);
    assert.equal(decoded.password_reset_required, false);
    assert.equal(decoded.sessionId, "session_abc123");
  } finally {
    if (previousDb) require.cache[dbPath] = previousDb;
    else delete require.cache[dbPath];
    if (previousController) require.cache[controllerPath] = previousController;
    else delete require.cache[controllerPath];
  }
});

test("checkSession verifies database as source of truth and mints refreshed token when user previously completed reset", async () => {
  const jwt = require("jsonwebtoken");
  const authControllerPath = require.resolve("../src/controllers/authController");
  const dbPath = require.resolve("../config/database_connection");
  const previousDb = require.cache[dbPath];
  const previousAuthController = require.cache[authControllerPath];

  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-12345";

  // Simulate an old token where password_reset_required was true at login time
  const staleToken = jwt.sign(
    {
      id: 99,
      email: "staff@goldendragon.com",
      role: "employee",
      sessionId: "session_valid_99",
      password_reset_required: true,
    },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );

  const fakeDb = {
    query: async (sql, params) => {
      if (sql.includes("SELECT active_session_id") || sql.includes("SELECT active_session_id, status")) {
        return [[{ active_session_id: "session_valid_99", status: "active" }]];
      }
      if (sql.includes("SELECT password_reset_required FROM employees")) {
        // Database confirms password has already been reset (value 0)
        return [[{ password_reset_required: 0 }]];
      }
      return [[]];
    },
  };

  try {
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakeDb };
    delete require.cache[authControllerPath];
    const { checkSession } = require(authControllerPath);

    const req = {
      headers: {
        authorization: `Bearer ${staleToken}`,
      },
    };

    let responseData = null;
    const res = {
      status() { return this; },
      json(data) { responseData = data; return this; },
    };

    await checkSession(req, res);

    assert.equal(responseData.authenticated, true);
    // Stale token's password_reset_required: true must be overturned by DB's live value: false
    assert.equal(responseData.password_reset_required, false);
    assert.ok(responseData.token, "Must return a refreshed clean token replacing the stale token");

    const cleanDecoded = jwt.verify(responseData.token, process.env.JWT_SECRET);
    assert.equal(cleanDecoded.id, 99);
    assert.equal(cleanDecoded.password_reset_required, false);
  } finally {
    if (previousDb) require.cache[dbPath] = previousDb;
    else delete require.cache[dbPath];
    if (previousAuthController) require.cache[authControllerPath] = previousAuthController;
    else delete require.cache[authControllerPath];
  }
});
