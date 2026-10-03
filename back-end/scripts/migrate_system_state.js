/**
 * Explicit, additive schema prerequisite for durable security state and the
 * zero-config reminder cutoff. Run only against an approved database target.
 */
const createSystemStateTable = `
  CREATE TABLE IF NOT EXISTS system_state (
    state_key VARCHAR(100) NOT NULL PRIMARY KEY,
    state_value LONGTEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

async function migrateSystemState({ db } = {}) {
  const database = db || require("../config/database_connection");
  await database.query(createSystemStateTable);
}

if (require.main === module) {
  const db = require("../config/database_connection");
  migrateSystemState({ db })
    .then(() => console.log("System state table migration completed."))
    .catch((error) => {
      console.error("System state table migration failed:", error.message);
      process.exitCode = 1;
    })
    .finally(() => db.end());
}

module.exports = { migrateSystemState };
