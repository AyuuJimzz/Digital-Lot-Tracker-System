// back-end/scripts/import_cloud_db.js
// Cloud Database Sync Tool for Aiven MySQL
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');

const envPath = path.join(__dirname, '..', '..', '.env');
require('dotenv').config({ path: envPath });

function parseUri(uriString) {
  try {
    const cleanUri = uriString.trim().replace(/^['"]|['"]$/g, '');
    const parsed = new URL(cleanUri);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '3306'),
      user: decodeURIComponent(parsed.username || 'avnadmin'),
      password: decodeURIComponent(parsed.password || ''),
      database: parsed.pathname.replace(/^\//, '') || 'defaultdb',
      multipleStatements: true,
      ssl: { rejectUnauthorized: false }
    };
  } catch (err) {
    return null;
  }
}

async function promptUser(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

async function run() {
  console.log('\n======================================================');
  console.log('       🐉 GOLDEN DRAGON - AIVEN CLOUD DB SYNC         ');
  console.log('======================================================\n');

  let connectionConfig = null;
  const cliInput = process.argv.slice(2)[0];

  // 1. Check if passed as CLI argument
  if (cliInput) {
    connectionConfig = parseUri(cliInput);
    if (!connectionConfig) {
      console.log('⚠️ Ang na-pass na text ay hindi valid na MySQL URI.');
    }
  }

  // 2. Check if AIVEN_SERVICE_URI is defined in .env
  if (!connectionConfig && process.env.AIVEN_SERVICE_URI) {
    connectionConfig = parseUri(process.env.AIVEN_SERVICE_URI);
    if (connectionConfig) {
      console.log('🔍 Natagpuan ang AIVEN_SERVICE_URI sa iyong .env file!');
    }
  }

  // 3. Check if DB_HOST in .env is already pointing to Aiven
  if (!connectionConfig && process.env.DB_HOST && process.env.DB_HOST.includes('aivencloud.com')) {
    connectionConfig = {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'avnadmin',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'defaultdb',
      multipleStatements: true,
      ssl: { rejectUnauthorized: false }
    };
    console.log('🔍 Gagamitin ang Aiven credentials mula sa .env (DB_HOST).');
  }

  // 4. If still not configured, prompt the user to paste their Aiven Service URI
  if (!connectionConfig) {
    console.log('📋 Paano kunin ang Aiven Service URI:');
    console.log('   1. Buksan ang iyong Aiven Dashboard (https://console.aiven.io)');
    console.log('   2. Piliin ang iyong MySQL service');
    console.log('   3. I-click ang "Copy" button sa tapat ng "Service URI"\n');

    const inputUri = await promptUser('👉 I-paste dito ang iyong Aiven Service URI: ');
    if (!inputUri) {
      console.log('\n❌ Walang na-paste na URI. Kinakansela ang sync.');
      process.exit(1);
    }

    connectionConfig = parseUri(inputUri);
    if (!connectionConfig) {
      console.log('\n❌ Invalid ang na-paste na URI format. Siguraduhing nagsisimula ito sa mysql://');
      process.exit(1);
    }

    // Ask to save in .env for future ease
    const saveChoice = await promptUser('\n💾 Gusto mo bang i-save ito sa .env para 1-click na lang sa susunod? (y/n): ');
    if (saveChoice.toLowerCase().startsWith('y')) {
      try {
        let currentEnv = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        if (currentEnv.includes('AIVEN_SERVICE_URI=')) {
          currentEnv = currentEnv.replace(/AIVEN_SERVICE_URI=.*/g, `AIVEN_SERVICE_URI=${inputUri}`);
        } else {
          currentEnv += `\n# Aiven Cloud MySQL Sync URI\nAIVEN_SERVICE_URI=${inputUri}\n`;
        }
        fs.writeFileSync(envPath, currentEnv, 'utf8');
        console.log('✅ Matagumpay na na-save sa .env! Sa susunod, `npm run db:sync-cloud` na lang ang kailangan.');
      } catch (e) {
        console.log('⚠️ Hindi na-save sa .env:', e.message);
      }
    }
  }

  console.log(`\n⏳ Kumukonekta sa Aiven MySQL (${connectionConfig.host}:${connectionConfig.port})...`);
  let connection;
  try {
    connection = await mysql.createConnection(connectionConfig);
    console.log('✅ Matagumpay na nakakonekta sa Aiven Cloud!');

    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    await connection.query('SET SESSION sql_require_primary_key = 0;');

    const backupDir = path.join(__dirname, '..', '..', 'database_Backup');
    const masterFile = path.join(backupDir, '00_golden_dragon_corp_FULL_BACKUP.sql');

    if (fs.existsSync(masterFile)) {
      console.log(`\n📦 Ina-upload ang 00_golden_dragon_corp_FULL_BACKUP.sql (Lahat ng 6 na tables at 596 lots)...`);
      let sqlContent = fs.readFileSync(masterFile, 'utf8');
      sqlContent = sqlContent.replace(/^USE\s+[^;]+;/gmi, '');
      await connection.query(sqlContent);
      console.log(`  ✅ Lahat ng tables, properties, annotations, at 596 lots ay nai-import na!`);
    } else {
      const sqlFiles = [
        '01_golden_dragon_corp_properties.sql',
        '02_golden_dragon_corp_lots.sql',
        '03_golden_dragon_corp_customers.sql',
        '04_golden_dragon_corp_admins.sql',
        '05_golden_dragon_corp_employees.sql',
        '06_golden_dragon_corp_transactions.sql',
        '07_password_reset_columns.sql',
      ];

      for (const file of sqlFiles) {
        const filePath = path.join(backupDir, file);
        if (!fs.existsSync(filePath)) continue;
        console.log(`Ina-upload ang ${file}...`);
        let sqlContent = fs.readFileSync(filePath, 'utf8');
        sqlContent = sqlContent.replace(/^USE\s+[^;]+;/gmi, '');
        await connection.query(sqlContent);
        console.log(`  ✅ ${file} uploaded!`);
      }
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('\n🎉 TAPOS NA! 100% UPDATED NA ANG IYONG AIVEN CLOUD DATABASE!\n');
  } catch (error) {
    console.error('\n❌ Error habang nag-i-import sa Aiven:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

run();
