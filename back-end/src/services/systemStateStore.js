const fs = require("fs");
const path = require("path");
const db = require("../../config/database_connection");

const configPath = path.join(__dirname, "../../config/system_state.json");
const defaultState = {
  maintenanceMode: false,
  developerPin: null,
  logs: [],
};

// These values affect application availability or security and must survive a
// Render restart. Logs and other diagnostics remain disposable file state.
const persistentKeys = new Set([
  "maintenanceMode",
  "developerPin",
  "developerPinHash",
  "runtimeDeveloperPin",
  "authRevocationTimestamp",
]);

let state = { ...defaultState };
let writeQueue = Promise.resolve();
let durableQueue = Promise.resolve();

async function loadSystemState() {
  try {
    const raw = await fs.promises.readFile(configPath, "utf8");
    state = { ...defaultState, ...JSON.parse(raw) };
  } catch (_) {
    state = { ...defaultState };
  }

  // Database state is authoritative for durable control/security settings.
  // This is best-effort so the server can still boot before setup_schema runs.
  try {
    const [rows] = await db.query("SELECT state_key, state_value FROM system_state");
    for (const row of rows) {
      if (!persistentKeys.has(row.state_key)) continue;
      try {
        state[row.state_key] = JSON.parse(row.state_value);
      } catch (_) {
        state[row.state_key] = row.state_value;
      }
    }

  } catch (_) {
    // The table may not exist until the explicit setup step is run.
  }
  return state;
}

function getSystemState() {
  return state;
}

function updateSystemState(fields) {
  state = { ...state, ...fields };
  queueFileWrite();

  const durableFields = Object.fromEntries(
    Object.entries(fields).filter(([key]) => persistentKeys.has(key))
  );
  if (Object.keys(durableFields).length > 0) {
    writeQueue = writeQueue
      .catch(() => {})
      .then(() => persistDatabaseState(durableFields))
      .catch((error) => console.error("Failed to persist durable system state:", error.message));
  }
  return state;
}

function queueFileWrite() {
  const nextState = JSON.stringify(state, null, 2);
  writeQueue = writeQueue
    .catch(() => {})
    .then(() => fs.promises.writeFile(configPath, nextState, "utf8"))
    .catch((error) => console.error("Failed to persist system state:", error.message));
}

// Security and availability controls must only report success after MySQL
// confirms the write. Serializing them also preserves the order of toggles.
function updateDurableSystemState(fields, deleteKeys = []) {
  const durableFields = Object.fromEntries(
    Object.entries(fields).filter(([key]) => persistentKeys.has(key))
  );
  if (Object.keys(durableFields).length === 0) {
    return Promise.reject(new Error("No durable system state fields supplied"));
  }

  const operation = durableQueue.then(async () => {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await persistDatabaseState(durableFields, connection);
      if (deleteKeys.length > 0) {
        await connection.query("DELETE FROM system_state WHERE state_key IN (?)", [deleteKeys]);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    state = { ...state, ...fields };
    for (const key of deleteKeys) state[key] = null;
    queueFileWrite();
    return state;
  });
  durableQueue = operation.catch(() => {});
  return operation;
}

async function persistDatabaseState(values, connection = db) {
  for (const [key, value] of Object.entries(values)) {
    await connection.query(
      `INSERT INTO system_state (state_key, state_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE state_value = VALUES(state_value), updated_at = CURRENT_TIMESTAMP`,
      [key, JSON.stringify(value)]
    );
  }
}

const ready = loadSystemState();

module.exports = {
  configPath,
  ready,
  loadSystemState,
  getSystemState,
  updateSystemState,
  updateDurableSystemState,
};
