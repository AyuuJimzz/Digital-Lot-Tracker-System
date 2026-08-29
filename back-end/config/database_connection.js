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

pool.on("error", (err) => {
  console.error("❌ MySQL Pool Error:", err.message);
  try {
    const { sendMessengerAlert } = require("../src/services/messengerAlertService");
    sendMessengerAlert("Aiven MySQL Database Error", err.message || "Database pool disconnection").catch(() => {});
  } catch (_) {}
});

module.exports = pool.promise();
