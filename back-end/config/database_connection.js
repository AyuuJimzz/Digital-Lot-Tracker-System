const mysql = require("mysql2");
require("dotenv").config({ path: __dirname + "/../../.env" });

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: (process.env.DB_SSL === "true" || process.env.DB_HOST?.includes("aivencloud.com"))
    ? { rejectUnauthorized: false }
    : undefined,
  waitForConnections: true,
  connectionLimit: 10,
});

// Test initial database connection on boot & auto-ensure is_demo column
pool.getConnection(async (err, connection) => {
  if (err) {
    console.error(`❌ [MySQL Database Connection Failed]: ${err.message} (Host: ${process.env.DB_HOST || "localhost"})`);
  } else {
    console.log(`🗄️  [MySQL Database Connected] Host: ${process.env.DB_HOST || "localhost"} | DB: ${process.env.DB_NAME || "goldendragon"} | SSL: ${!!process.env.DB_SSL || !!process.env.DB_HOST?.includes("aivencloud.com")}`);
    try {
      await connection.promise().query("ALTER TABLE customers ADD COLUMN is_demo TINYINT(1) DEFAULT 0");
    } catch (cErr) {
      if (cErr.code !== "ER_DUP_FIELDNAME") console.warn("customers is_demo notice:", cErr.message);
    }
    try {
      await connection.promise().query("ALTER TABLE transactions ADD COLUMN is_demo TINYINT(1) DEFAULT 0");
    } catch (tErr) {
      if (tErr.code !== "ER_DUP_FIELDNAME") console.warn("transactions is_demo notice:", tErr.message);
    }
    try {
      await connection.promise().query("ALTER TABLE transactions ADD COLUMN agent_name VARCHAR(255) DEFAULT NULL");
    } catch (aErr) {
      if (aErr.code !== "ER_DUP_FIELDNAME") console.warn("transactions agent_name notice:", aErr.message);
    }
    try {
      await connection.promise().query(`
        UPDATE transactions t
        JOIN employees e ON t.employee_id = e.employee_id
        SET t.agent_name = TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')))
        WHERE (t.agent_name IS NULL OR t.agent_name = '') AND t.employee_id IS NOT NULL
      `);
    } catch (_) {}
    connection.release();
  }
});

pool.on("error", (err) => {
  console.error("❌ [MySQL Pool Disconnection Error]:", err.message);
  try {
    const { sendMessengerAlert } = require("../src/services/messengerAlertService");
    sendMessengerAlert("Aiven MySQL Database Error", err.message || "Database pool disconnection").catch(() => {});
  } catch (_) {}
});

module.exports = pool.promise();
