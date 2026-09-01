const db = require('../config/database_connection');
const fs = require('fs');
const path = require('path');

function escapeSqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (val instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `'${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())} ${pad(val.getHours())}:${pad(val.getMinutes())}:${pad(val.getSeconds())}'`;
  }
  if (typeof val === 'object') {
    const jsonStr = JSON.stringify(val);
    const escaped = jsonStr.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }
  const str = String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '').replace(/\n/g, '\\n');
  return `'${str}'`;
}

async function exportAll() {
  const backupDir = path.resolve(__dirname, '../../database_Backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const [tables] = await db.query('SHOW TABLES');
  const tableOrder = ['properties', 'lots', 'customers', 'admins', 'employees', 'transactions'];

  const fileMap = {
    properties: '01_golden_dragon_corp_properties.sql',
    lots: '02_golden_dragon_corp_lots.sql',
    customers: '03_golden_dragon_corp_customers.sql',
    admins: '04_golden_dragon_corp_admins.sql',
    employees: '05_golden_dragon_corp_employees.sql',
    transactions: '06_golden_dragon_corp_transactions.sql',
  };

  const foundTableNames = tables.map(t => Object.values(t)[0]);

  for (const tableName of foundTableNames) {
    const [createRes] = await db.query(`SHOW CREATE TABLE \`${tableName}\``);
    const createSql = createRes[0]['Create Table'];
    const [rows] = await db.query(`SELECT * FROM \`${tableName}\``);

    let sql = `-- Golden Dragon Corp Database Backup\n`;
    sql += `-- Table: ${tableName}\n`;
    sql += `-- Generated on: ${new Date().toISOString()}\n\n`;
    sql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
    sql += `${createSql};\n\n`;

    if (rows.length > 0) {
      const keys = Object.keys(rows[0]);
      sql += `LOCK TABLES \`${tableName}\` WRITE;\n`;
      sql += `/*!40000 ALTER TABLE \`${tableName}\` DISABLE KEYS */;\n`;
      sql += `INSERT INTO \`${tableName}\` (\`${keys.join('`, `')}\`) VALUES\n`;

      const valLines = rows.map((r) => {
        const values = keys.map((k) => escapeSqlValue(r[k]));
        return `  (${values.join(', ')})`;
      });

      sql += `${valLines.join(',\n')};\n`;
      sql += `/*!40000 ALTER TABLE \`${tableName}\` ENABLE KEYS */;\n`;
      sql += `UNLOCK TABLES;\n`;
    }

    const fileName = fileMap[tableName] || `${tableName}.sql`;
    fs.writeFileSync(path.join(backupDir, fileName), sql, 'utf8');
    console.log(`✅ Saved ${fileName} (${rows.length} rows)`);
  }

  // Generate 00_golden_dragon_corp_FULL_BACKUP.sql
  let fullSql = `-- Golden Dragon Corp FULL CONSOLIDATED DATABASE BACKUP\n`;
  fullSql += `-- Generated on: ${new Date().toISOString()}\n`;
  fullSql += `/*!40101 SET NAMES utf8mb4 */;\n`;
  fullSql += `/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;\n`;
  fullSql += `/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;\n`;
  fullSql += `/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;\n\n`;

  for (const tableName of tableOrder) {
    if (!foundTableNames.includes(tableName)) continue;
    const [createRes] = await db.query(`SHOW CREATE TABLE \`${tableName}\``);
    const createSql = createRes[0]['Create Table'];
    const [rows] = await db.query(`SELECT * FROM \`${tableName}\``);

    fullSql += `-- ------------------------------------------------------\n`;
    fullSql += `-- Table structure for \`${tableName}\`\n`;
    fullSql += `-- ------------------------------------------------------\n`;
    fullSql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
    fullSql += `${createSql};\n\n`;

    if (rows.length > 0) {
      const keys = Object.keys(rows[0]);
      fullSql += `LOCK TABLES \`${tableName}\` WRITE;\n`;
      fullSql += `/*!40000 ALTER TABLE \`${tableName}\` DISABLE KEYS */;\n`;
      fullSql += `INSERT INTO \`${tableName}\` (\`${keys.join('`, `')}\`) VALUES\n`;

      const valLines = rows.map((r) => {
        const values = keys.map((k) => escapeSqlValue(r[k]));
        return `  (${values.join(', ')})`;
      });

      fullSql += `${valLines.join(',\n')};\n`;
      fullSql += `/*!40000 ALTER TABLE \`${tableName}\` ENABLE KEYS */;\n`;
      fullSql += `UNLOCK TABLES;\n\n`;
    }
  }

  fullSql += `/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;\n`;
  fullSql += `/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;\n`;

  fs.writeFileSync(path.join(backupDir, '00_golden_dragon_corp_FULL_BACKUP.sql'), fullSql, 'utf8');
  console.log(`✅ Saved 00_golden_dragon_corp_FULL_BACKUP.sql (All 6 tables)`);

  process.exit(0);
}

exportAll().catch((err) => {
  console.error('Error exporting database:', err);
  process.exit(1);
});
