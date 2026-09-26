async function migrateLoginHistory({ db } = {}) {
  const connection = db || require("../config/database_connection");
  await connection.query(`CREATE TABLE IF NOT EXISTS account_login_history (
    login_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    account_role VARCHAR(16) NOT NULL,
    account_id INT NOT NULL,
    session_hash CHAR(64) NOT NULL,
    device VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45) NULL,
    signed_in_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_login_session (session_hash),
    KEY idx_login_account (account_role, account_id, signed_in_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

if (require.main === module) {
  const db = require("../config/database_connection");
  migrateLoginHistory({ db })
    .then(async () => {
      console.log("Login history migration completed.");
      await db.end();
    })
    .catch(async (error) => {
      console.error("Login history migration failed:", error.message);
      await db.end();
      process.exitCode = 1;
    });
}

module.exports = { migrateLoginHistory };
