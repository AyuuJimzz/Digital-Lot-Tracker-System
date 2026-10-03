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
const isProduction = process.env.NODE_ENV === "production" || !!process.env.RENDER ||
  process.env.DB_HOST?.includes("aivencloud.com");

let state = { ...defaultState };
let writeQueue = Promise.resolve();
let durableQueue = Promise.resolve();
let retryTimer = null;

async function syncStateFromDatabase() {
  // Acquiring a connection also detects when MySQL comes online after startup.
  const connection = await db.getConnection();
  try {
    // Schema creation is an explicit release migration, never a startup side effect.
    const [rows] = await connection.query("SELECT state_key, state_value FROM system_state");
    const durableState = {
      maintenanceMode: false,
      developerPin: null,
      developerPinHash: null,
      runtimeDeveloperPin: null,
      authRevocationTimestamp: null,
    };
    for (const row of rows) {
      if (!persistentKeys.has(row.state_key)) continue;
      try {
        durableState[row.state_key] = JSON.parse(row.state_value);
      } catch (_) {
        durableState[row.state_key] = row.state_value;
      }
    }
    state = { ...state, ...durableState };
    return state;
  } finally {
    connection.release();
  }
}

function scheduleSyncRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(async () => {
    retryTimer = null;
    try {
      await syncStateFromDatabase();
      console.log("Persistent system state synchronized from MySQL.");
    } catch (error) {
      scheduleSyncRetry();
    }
  }, 2000);
  retryTimer.unref?.();
}

async function loadSystemState() {
  try {
    const raw = await fs.promises.readFile(configPath, "utf8");
    state = { ...defaultState, ...JSON.parse(raw) };
  } catch (_) {
    state = { ...defaultState };
  }

  // Production must not serve requests with stale maintenance/revocation state.
  // In local development, keep the previous startup behavior and retry in the background.
  try {
    return await syncStateFromDatabase();
  } catch (error) {
    console.warn("Initial MySQL system-state sync failed:", error.message);
    if (!isProduction) {
      scheduleSyncRetry();
      return state;
    }
  }

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      return await syncStateFromDatabase();
    } catch (error) {
      console.warn("Waiting for MySQL system-state sync:", error.message);
    }
  }
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
  syncStateFromDatabase,
  getSystemState,
  updateSystemState,
  updateDurableSystemState,
};
