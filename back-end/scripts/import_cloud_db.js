// back-end/scripts/import_cloud_db.js
// Run this script to import all 01-06 database_Backup SQL files to Aiven Cloud MySQL
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const host = process.env.DB_HOST || 'localhost';
const port = parseInt(process.env.DB_PORT || '3306');
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const database = process.env.DB_NAME || 'golden_dragon_corp';
const isCloud = host.includes('aivencloud.com') || process.env.DB_SSL === 'true';

const connectionConfig = {
  host,
  port,
  user,
  password,
  database,
  multipleStatements: true,
  ...(isCloud ? { ssl: { rejectUnauthorized: false } } : {})
};

async function importDatabase() {
  console.log(`Connecting to Cloud MySQL host (${connectionConfig.host}:${connectionConfig.port})...`);
  let connection;
  try {
    connection = await mysql.createConnection(connectionConfig);
    console.log('✅ Connected successfully to Cloud MySQL!');

    // Disable foreign key checks and sql_require_primary_key for smooth importing
    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    await connection.query('SET SESSION sql_require_primary_key = 0;');

    // Drop existing tables to ensure clean re-importing
    const tablesToDrop = ['transactions', 'customers', 'lots', 'properties', 'employees', 'admins'];
    for (const t of tablesToDrop) {
      await connection.query(`DROP TABLE IF EXISTS \`${t}\`;`);
    }

    const backupDir = path.join(__dirname, '..', '..', 'database_Backup');
    const sqlFiles = [
      '01_golden_dragon_corp_properties.sql',
      '02_golden_dragon_corp_lots.sql',
      '03_golden_dragon_corp_customers.sql',
      '04_golden_dragon_corp_admins.sql',
      '05_golden_dragon_corp_employees.sql',
      '06_golden_dragon_corp_transactions.sql',
    ];

    for (const file of sqlFiles) {
      const filePath = path.join(backupDir, file);
      if (!fs.existsSync(filePath)) {
        console.error(`⚠️ File not found: ${filePath}`);
        continue;
      }
      console.log(`Importing ${file}...`);
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      await connection.query(sqlContent);
      console.log(`  ✅ ${file} imported successfully!`);
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');

    console.log('\n🎉 ALL DATABASE BACKUP FILES IMPORTED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Error during database import:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

importDatabase();
