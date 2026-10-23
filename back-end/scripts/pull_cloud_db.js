// back-end/scripts/pull_cloud_db.js
// Cloud Database Pull Tool: Copies the latest live database from Aiven Cloud MySQL into Local MySQL
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

async function pullCloudDb() {
  console.log('======================================================');
  console.log('       🐉 SYNCING LIVE AIVEN DB TO LOCAL MYSQL        ');
  console.log('======================================================\n');

  const aivenUri = process.env.AIVEN_SERVICE_URI;
  if (!aivenUri) {
    throw new Error('AIVEN_SERVICE_URI not found in .env');
  }

  const parsed = new URL(aivenUri.trim().replace(/^['"]|['"]$/g, ''));
  const aivenConfig = {
    host: parsed.hostname,
    port: parseInt(parsed.port || '3306'),
    user: decodeURIComponent(parsed.username || 'avnadmin'),
    password: decodeURIComponent(parsed.password || ''),
    database: parsed.pathname.replace(/^\//, '') || 'defaultdb',
    ssl: { rejectUnauthorized: false }
  };

  const localConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'golden_dragon_corp',
    multipleStatements: true
  };

  console.log(`Connecting to Live Aiven: ${aivenConfig.host}...`);
  const aivenConn = await mysql.createConnection(aivenConfig);
  console.log('✅ Connected to Live Aiven!\n');

  console.log(`Connecting to Local MySQL: ${localConfig.host}:${localConfig.port}/${localConfig.database}...`);
  const localConn = await mysql.createConnection(localConfig);
  console.log('✅ Connected to Local MySQL!\n');

  const tables = [
    'properties',
    'admins',
    'employees',
    'customers',
    'lots',
    'transactions',
    'sale_date_audit',
    'system_state',
    'account_login_history'
  ];

  await localConn.query('SET FOREIGN_KEY_CHECKS = 0');
  await localConn.query("SET SESSION sql_mode = 'ANSI_QUOTES,NO_ENGINE_SUBSTITUTION'");

  for (const table of tables) {
    try {
      const [createRes] = await aivenConn.query(`SHOW CREATE TABLE \`${table}\``);
      const createSql = createRes[0]['Create Table'];
      await localConn.query(`DROP TABLE IF EXISTS \`${table}\``);
      await localConn.query(createSql);
    } catch (err) {
      console.warn(`⚠️ Could not recreate table structure for ${table}:`, err.message);
      await localConn.query(`TRUNCATE TABLE \`${table}\``);
    }

    const [rows] = await aivenConn.query(`SELECT * FROM \`${table}\``);
    if (rows.length === 0) {
      console.log(`- ${table}: 0 rows (empty on Aiven)`);
      continue;
    }

    const columns = Object.keys(rows[0]);
    const placeholders = `(${columns.map(() => '?').join(', ')})`;
    const insertSql = `INSERT INTO \`${table}\` (\`${columns.join('`, `')}\`) VALUES ${placeholders}`;

    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      for (const row of batch) {
        const values = columns.map(c => {
          const val = row[c];
          if (val && typeof val === 'object' && !(val instanceof Date)) {
            return JSON.stringify(val);
          }
          return val;
        });
        await localConn.query(insertSql, values);
      }
    }
    console.log(`✅ ${table}: successfully copied ${rows.length} rows from Aiven to local!`);
  }

  await localConn.query('SET FOREIGN_KEY_CHECKS = 1');
  await aivenConn.end();
  await localConn.end();

  console.log('\n🎉 Finished transferring Live Aiven data into Local MySQL!');

  // Run payment terms migration on local to ensure new payment columns are preserved
  console.log('\nRunning migrate_payment_terms.js on local database to preserve new quotation columns...');
  const { migratePaymentTerms } = require('./migrate_payment_terms');
  await migratePaymentTerms();
}

if (require.main === module) {
  pullCloudDb().catch(err => {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  });
}

module.exports = { pullCloudDb };
