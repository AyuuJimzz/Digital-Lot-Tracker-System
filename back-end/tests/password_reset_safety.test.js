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
