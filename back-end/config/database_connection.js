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
  connectionLimit: 6,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

// Test initial database connection on boot. Schema changes belong to the
// explicit setup script, never to normal web-service startup.
pool.getConnection(async (err, connection) => {
  if (err) {
    console.error(`❌ [MySQL Database Connection Failed]: ${err.message} (Host: ${process.env.DB_HOST || "localhost"})`);
  } else {
    console.log(`🗄️  [MySQL Database Connected] Host: ${process.env.DB_HOST || "localhost"} | DB: ${process.env.DB_NAME || "goldendragon"} | SSL: ${!!process.env.DB_SSL || !!process.env.DB_HOST?.includes("aivencloud.com")}`);
    connection.release();
  }
});

pool.on("error", (err) => {
  console.error("❌ [MySQL Pool Disconnection Error]:", err.message);
});

module.exports = pool.promise();
