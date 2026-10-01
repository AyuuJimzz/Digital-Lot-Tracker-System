const assert = require("node:assert/strict");
const test = require("node:test");

const SENTINEL = "9999-12-31 23:59:59";
const CUTOFF = "2020-01-01 00:00:00";
const key = (date) => new Date(date).toISOString().slice(0, 19).replace("T", " ");
const hoursAgo = (hours) => new Date(Date.now() - hours * 3600 * 1000);

function response() {
  return {
    code: 200,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function withMocks(options, run) {
  const dbPath = require.resolve("../config/database_connection");
  const emailPath = require.resolve("../src/services/emailService");
  const controllerPath = require.resolve("../src/controllers/lots/lotRemindersController");
  const old = [dbPath, emailPath, controllerPath].map((path) => require.cache[path]);
  const systemState = options.initialSystemState || {};
  const lot = options.lot || {
    lot_id: 101, lot_number: "Lot 5 Block 2", property_name: "Golden Heights",
    location: "Tagaytay", customer_id: 1, email: "juan@example.com",
    status: "Pending", pending_since: hoursAgo(13), last_reminder_sent: null,
  };
  const deliveries = [];
  let claims = 0;
  let cutoffInsertAttempts = 0;
  let firstSelects = 0;
  let inventoryReads = 0;
  const firstWaiters = [];
  const fakeDb = {
    async query(sql, params = []) {
      if (sql.includes("INSERT INTO system_state")) {
        if (options.failCutoffInsert) throw new Error("Database write unavailable");
        // Simulate MySQL's atomic primary-key insert: the first instance wins.
        const candidate = options.serverNowValues?.[cutoffInsertAttempts++] || options.serverNow || CUTOFF;
        systemState.reminder_cutoff ??= candidate;
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("SELECT state_value FROM system_state WHERE state_key = 'reminder_cutoff'")) {
        if (options.failCutoffRead) throw new Error("Database read unavailable");
        return systemState.reminder_cutoff
          ? [[{ state_value: systemState.reminder_cutoff }]]
          : [[]];
      }
      if (sql.includes("SELECT l.lot_id") && sql.includes("l.last_reminder_sent IS NULL")) {
        inventoryReads++;
        firstSelects++;
        assert.ok(sql.includes("AND l.pending_since > ?"), "Inventory selection must require the cutoff");
        const cutoffMet = key(lot.pending_since) > params[0];
        const eligible = lot.status === "Pending" && cutoffMet &&
          (Date.now() - lot.pending_since.getTime()) > 12 * 3600 * 1000 &&
          lot.last_reminder_sent === null;
        const snapshot = eligible ? [{ ...lot, pending_key: key(lot.pending_since), reminder_key: null }] : [];
        if (options.barrier && firstSelects <= 2) {
          await new Promise((resolve) => {
            firstWaiters.push(resolve);
            if (firstWaiters.length === 2) firstWaiters.forEach((release) => release());
          });
        }
        if (options.afterFirstSelect) options.afterFirstSelect(lot);
        return [snapshot];
      }
      if (sql.includes("SELECT l.lot_id") && sql.includes("l.last_reminder_sent < DATE_SUB")) {
        inventoryReads++;
        const elapsed = lot.last_reminder_sent instanceof Date
          ? Date.now() - lot.last_reminder_sent.getTime() : -1;
        assert.ok(sql.includes("AND l.pending_since > ?"), "Final selection must require the cutoff");
        const cutoffMet = key(lot.pending_since) > params[0];
        const eligible = lot.status === "Pending" && cutoffMet &&
          (Date.now() - lot.pending_since.getTime()) > 24 * 3600 * 1000 &&
          elapsed > 12 * 3600 * 1000;
        return [eligible ? [{ ...lot, pending_key: key(lot.pending_since),
          reminder_key: key(lot.last_reminder_sent) }] : []];
      }
      if (sql.includes("SELECT l.status, DATE_FORMAT")) {
        return [[{ status: lot.status, pending_key: key(lot.pending_since),
          reminder_key: lot.last_reminder_sent === SENTINEL ? SENTINEL : null,
          customer_id: lot.customer_id, email: lot.email }]];
      }
      if (sql.includes("UPDATE lots l SET l.last_reminder_sent = ?")) {
        claims++;
        assert.ok(sql.includes("AND l.pending_since > ?"), "Claim must require the cutoff");
        const [sentinel, id, pendingKey, ...rest] = params;
        const cutoff = rest.shift();
        const tail = rest;
        assert.equal(sentinel, SENTINEL);
        assert.ok(sql.includes("current_customer.customer_id = ?"), "Claim must bind customer identity");
        const final = sql.includes("l.last_reminder_sent = ? AND l.last_reminder_sent < DATE_SUB");
        const [prior, customerId, email] = final ? tail : [null, ...tail];
        const cutoffMet = pendingKey > cutoff;
        const valid = id === lot.lot_id && lot.status === "Pending" &&
          key(lot.pending_since) === pendingKey && cutoffMet &&
          customerId === lot.customer_id && email === lot.email &&
          (final ? lot.last_reminder_sent instanceof Date && key(lot.last_reminder_sent) === prior
            : lot.last_reminder_sent === null);
        if (valid) lot.last_reminder_sent = SENTINEL;
        return [{ affectedRows: valid ? 1 : 0 }];
      }
      if (sql.includes("UPDATE lots l SET l.last_reminder_sent = NOW()")) {
        const [id, pendingKey, sentinel, customerId, email] = params;
        const valid = id === lot.lot_id && key(lot.pending_since) === pendingKey &&
          lot.last_reminder_sent === sentinel && lot.status === "Pending" &&
          lot.customer_id === customerId && lot.email === email;
        if (valid) lot.last_reminder_sent = new Date();
        return [{ affectedRows: valid ? 1 : 0 }];
      }
      throw new Error(`Unexpected reminder SQL: ${sql}`);
    },
  };

  try {
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakeDb };
    require.cache[emailPath] = { id: emailPath, filename: emailPath, loaded: true,
      exports: { sendEmail: async (...args) => {
        deliveries.push(args);
        return options.sendEmail ? options.sendEmail(...args) : { success: true };
      } } };
    delete require.cache[controllerPath];
    const firstModule = require(controllerPath);
    const first = firstModule.sendPendingLotReminders;
    const firstEnsure = firstModule.ensureReminderCutoff;
    delete require.cache[controllerPath];
    const secondModule = require(controllerPath);
    const second = secondModule.sendPendingLotReminders;
    const secondEnsure = secondModule.ensureReminderCutoff;
    await run({ lot, deliveries, first, second, firstEnsure, secondEnsure,
      getClaims: () => claims, getInventoryReads: () => inventoryReads, systemState });
  } finally {
    [dbPath, emailPath, controllerPath].forEach((path, index) => {
      if (old[index]) require.cache[path] = old[index];
      else delete require.cache[path];
    });
  }
}

test("zero-config initialization stores and reads a persistent database cutoff", async () => {
  await withMocks({ serverNow: "2026-10-02 00:00:00" }, async ({ firstEnsure, systemState }) => {
    assert.equal(systemState.reminder_cutoff, undefined);
    assert.equal(await firstEnsure(), "2026-10-02 00:00:00");
    assert.equal(systemState.reminder_cutoff, "2026-10-02 00:00:00", "Cutoff must be auto-stored in database");
  });
});

test("concurrent server instances read the same stored winner", async () => {
  await withMocks({ serverNowValues: ["2026-10-02 00:00:00", "2026-10-02 00:00:02"] },
    async ({ firstEnsure, secondEnsure, systemState }) => {
    const cutoffs = await Promise.all([firstEnsure(), secondEnsure()]);
    assert.equal(systemState.reminder_cutoff, "2026-10-02 00:00:00");
    assert.deepEqual(cutoffs, [systemState.reminder_cutoff, systemState.reminder_cutoff]);
  });
});

test("cutoff write/read failure or corrupt state fails closed before inventory selection", async () => {
  const originalError = console.error;
  const expectedErrors = [];
  console.error = (...args) => expectedErrors.push(args);
  try {
    for (const options of [
      { failCutoffInsert: true },
      { failCutoffRead: true },
      { initialSystemState: { reminder_cutoff: "bad-date" } },
    ]) {
      await withMocks(options, async ({ first, deliveries, getInventoryReads }) => {
        const res = response();
        await first({}, res);
        assert.equal(res.code, 500);
        assert.equal(getInventoryReads(), 0);
        assert.equal(deliveries.length, 0);
      });
    }
    assert.equal(expectedErrors.length, 3);
  } finally {
    console.error = originalError;
  }
});

test("new reservation: first, final, then no more emails", async () => {
  await withMocks({}, async ({ lot, deliveries, first }) => {
    await first({}, response());
    assert.equal(deliveries.length, 1);
    assert.ok(lot.last_reminder_sent instanceof Date);

    lot.pending_since = hoursAgo(25);
    lot.last_reminder_sent = hoursAgo(12.1);
    await first({}, response());
    assert.equal(deliveries.length, 2);
    assert.match(deliveries[1][1], /^Final Lot Reservation Reminder/);
    assert.equal(lot.last_reminder_sent, SENTINEL);

    lot.pending_since = hoursAgo(90);
    await first({}, response());
    assert.equal(deliveries.length, 2);
  });
});

test("late first reminder is not silenced by reservation age (resolves Codex timing trap)", async () => {
  // Even if 1st reminder happens late at 40h, and final reminder happens at 52h (40 + 12 = 52h),
  // Option 1 has no artificial 48-hour ceiling, so the final reminder is sent successfully!
  await withMocks({ lot: {
    lot_id: 102, lot_number: "Lot 8", property_name: "Golden Heights", location: "Tagaytay",
    customer_id: 2, email: "maria@example.com", status: "Pending",
    pending_since: hoursAgo(40), last_reminder_sent: null,
  } }, async ({ lot, deliveries, first }) => {
    await first({}, response());
    assert.equal(deliveries.length, 1);

    // Final reminder 12h later (reservation is now 52 hours old!)
    lot.pending_since = hoursAgo(52);
    lot.last_reminder_sent = hoursAgo(12.1);
    await first({}, response());
    assert.equal(deliveries.length, 2, "Final reminder must send even at 52h without 48h ceiling trap");
  });
});

test("separate controller instances share the atomic database claim", async () => {
  await withMocks({ barrier: true }, async ({ deliveries, first, second, getClaims }) => {
    await Promise.all([first({}, response()), second({}, response())]);
    assert.equal(getClaims(), 2, "Both instances must reach the database claim");
    assert.equal(deliveries.length, 1);
  });
});

test("changed reservation is not claimed from a stale selection", async () => {
  await withMocks({ afterFirstSelect: (lot) => {
    lot.customer_id = 3;
    lot.email = "new@example.com";
    lot.pending_since = hoursAgo(1);
  } }, async ({ deliveries, first }) => {
    await first({}, response());
    assert.equal(deliveries.length, 0);
  });
});

test("ambiguous email failure stays claimed instead of retrying or sending final", async () => {
  await withMocks({ sendEmail: async () => { throw new Error("timeout after provider accepted"); } },
    async ({ lot, deliveries, first }) => {
      await first({}, response());
      assert.equal(lot.last_reminder_sent, SENTINEL);
      lot.pending_since = hoursAgo(40);
      await first({}, response());
      assert.equal(deliveries.length, 1);
    });
});

test("pre-rollout legacy reservations predating the cutoff are permanently untouched", async () => {
  // When cutoff in database is 2026-10-02 00:00:00, any reservation before that date is ignored
  await withMocks({
    initialSystemState: { reminder_cutoff: "2026-10-02 00:00:00" },
    lot: {
      lot_id: 103, lot_number: "Lot 9", property_name: "Golden Heights", location: "Tagaytay",
      customer_id: 3, email: "legacy@example.com", status: "Pending",
      pending_since: new Date("2026-10-01 12:00:00"), // 12h before cutoff
      last_reminder_sent: null,
    },
  }, async ({ deliveries, first }) => {
    await first({}, response());
    assert.equal(deliveries.length, 0, "Legacy reservations must never receive emails");
  });
});

test("a reservation in the cutoff second is conservatively excluded", async () => {
  const pendingSince = hoursAgo(13);
  await withMocks({
    initialSystemState: { reminder_cutoff: key(pendingSince) },
    lot: {
      lot_id: 106, lot_number: "Lot 11", property_name: "Golden Heights", location: "Tagaytay",
      customer_id: 6, email: "boundary@example.com", status: "Pending",
      pending_since: pendingSince, last_reminder_sent: null,
    },
  }, async ({ deliveries, first }) => {
    await first({}, response());
    assert.equal(deliveries.length, 0);
  });
});

test("existing cutoff is never replaced on subsequent initialization", async () => {
  await withMocks({
    serverNow: "2030-01-01 00:00:00",
    initialSystemState: { reminder_cutoff: CUTOFF },
  }, async ({ firstEnsure, systemState }) => {
    assert.equal(await firstEnsure(), CUTOFF);
    assert.equal(systemState.reminder_cutoff, CUTOFF);
  });
});
