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

// Test initial database connection on boot
pool.getConnection((err, connection) => {
  if (err) {
    console.error(`❌ [MySQL Database Connection Failed]: ${err.message} (Host: ${process.env.DB_HOST || "localhost"})`);
  } else {
    console.log(`🗄️  [MySQL Database Connected] Host: ${process.env.DB_HOST || "localhost"} | DB: ${process.env.DB_NAME || "goldendragon"} | SSL: ${!!process.env.DB_SSL || !!process.env.DB_HOST?.includes("aivencloud.com")}`);
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
