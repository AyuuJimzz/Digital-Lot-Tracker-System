// services/dbBackupService.js
const db = require("../../config/database_connection");

/**
 * Generates a full SQL dump content (DDL + DML) for the database.
 * Does not require external mysqldump binary.
 */
async function generateBackupSql() {
  let sqlContent = `-- Golden Dragon Estate Platform - Developer Database Backup\n`;
  sqlContent += `-- Generated: ${new Date().toISOString()}\n`;
  sqlContent += `-- ========================================================\n\n`;
  sqlContent += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

  // 1. Get all tables in database
  const [tablesResult] = await db.query("SHOW TABLES");
  const dbNameKey = Object.keys(tablesResult[0] || {})[0];
  if (!dbNameKey) {
    throw new Error("No tables found in database");
  }

  const tableNames = tablesResult.map((row) => row[dbNameKey]);

  for (const tableName of tableNames) {
    sqlContent += `-- --------------------------------------------------------\n`;
    sqlContent += `-- Table structure for table \`${tableName}\`\n`;
    sqlContent += `-- --------------------------------------------------------\n`;
    sqlContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;

    // 2. Get CREATE TABLE statement
    const [[createTableResult]] = await db.query(`SHOW CREATE TABLE \`${tableName}\``);
    const createTableSql = createTableResult["Create Table"];
    sqlContent += `${createTableSql};\n\n`;

    // 3. Get table rows
    const [rows] = await db.query(`SELECT * FROM \`${tableName}\``);
    if (rows.length > 0) {
      sqlContent += `-- Dump data for table \`${tableName}\`\n`;
      for (const row of rows) {
        const columns = Object.keys(row).map((col) => `\`${col}\``).join(", ");
        const values = Object.values(row).map((val) => {
          if (val === null) return "NULL";
          if (typeof val === "number" || typeof val === "boolean") return val;
          if (val instanceof Date) {
            return `'${val.toISOString().slice(0, 19).replace("T", " ")}'`;
          }
          // Escape single quotes and backslashes
          const escaped = val.toString().replace(/\\/g, "\\\\").replace(/'/g, "''");
          return `'${escaped}'`;
        }).join(", ");

        sqlContent += `INSERT INTO \`${tableName}\` (${columns}) VALUES (${values});\n`;
      }
      sqlContent += `\n`;
    }
  }

  sqlContent += `SET FOREIGN_KEY_CHECKS = 1;\n`;
  return sqlContent;
}

module.exports = {
  generateBackupSql,
};
