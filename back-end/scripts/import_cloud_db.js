// back-end/scripts/import_cloud_db.js
// Cloud Database Sync Tool for Aiven MySQL
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');
const { getDatabaseSslConfig } = require('../config/database_ssl');

const envPath = path.join(__dirname, '..', '..', '.env');
require('dotenv').config({ path: envPath });

function getSslConfig(host) {
  try {
    return getDatabaseSslConfig(host, true);
  } catch (_) {
    return { rejectUnauthorized: false };
  }
}

function parseUri(uriString) {
  let parsed;
  try {
    const cleanUri = uriString.trim().replace(/^['"]|['"]$/g, '');
    parsed = new URL(cleanUri);
  } catch (err) {
    return null;
  }
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '3306'),
    user: decodeURIComponent(parsed.username || 'avnadmin'),
    password: decodeURIComponent(parsed.password || ''),
    database: parsed.pathname.replace(/^\//, '') || 'defaultdb',
    multipleStatements: true,
    ssl: getSslConfig(parsed.hostname)
  };
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

  const backupDir = path.join(__dirname, '..', '..', 'database_Backup');
  const snapshotsDir = path.join(backupDir, 'backup_history');

  let masterFile = null;
  const latestCandidates = fs.existsSync(backupDir)
    ? fs.readdirSync(backupDir).filter((file) => file.startsWith('latest_cloud_backup') && file.endsWith('.sql'))
    : [];

  if (latestCandidates.length > 0) {
    masterFile = path.join(backupDir, latestCandidates[0]);
  } else if (fs.existsSync(snapshotsDir)) {
    const snapshots = fs
      .readdirSync(snapshotsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();
    if (snapshots.length > 0) {
      masterFile = path.join(snapshotsDir, snapshots[snapshots.length - 1]);
    }
  }

  if (!masterFile || !fs.existsSync(masterFile)) {
    console.error('❌ Missing database backup snapshot. db:sync-cloud was cancelled before connecting to Aiven.');
    process.exitCode = 1;
    return;
  }

  let connectionConfig = null;
  const cliInput = process.argv.slice(2)[0];

  // 1. Check if passed as CLI argument
  if (cliInput) {
    connectionConfig = parseUri(cliInput);
    if (!connectionConfig) {
      console.log('⚠️ The provided argument is not a valid MySQL URI.');
    }
  }

  // 2. Check if AIVEN_SERVICE_URI is defined in .env
  if (!connectionConfig && process.env.AIVEN_SERVICE_URI) {
    connectionConfig = parseUri(process.env.AIVEN_SERVICE_URI);
    if (connectionConfig) {
      console.log('🔍 Found AIVEN_SERVICE_URI in .env file!');
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
      ssl: getSslConfig(process.env.DB_HOST)
    };
    console.log('🔍 Using Aiven credentials from .env (DB_HOST).');
  }

  // 4. If still not configured, prompt the user to paste their Aiven Service URI
  if (!connectionConfig) {
    console.log('📋 How to retrieve your Aiven Service URI:');
    console.log('   1. Open your Aiven Dashboard (https://console.aiven.io)');
    console.log('   2. Select your MySQL service');
    console.log('   3. Click the "Copy" button next to "Service URI"\n');

    const inputUri = await promptUser('👉 Paste your Aiven Service URI here: ');
    if (!inputUri) {
      console.log('\n❌ No URI provided. Cancelling sync.');
      process.exit(1);
    }

    connectionConfig = parseUri(inputUri);
    if (!connectionConfig) {
      console.log('\n❌ Invalid URI format. Ensure it begins with mysql://');
      process.exit(1);
    }

    // Ask to save in .env for future ease
    const saveChoice = await promptUser('\n💾 Save this to .env for 1-click execution in the future? (y/n): ');
    if (saveChoice.toLowerCase().startsWith('y')) {
      try {
        let currentEnv = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        if (currentEnv.includes('AIVEN_SERVICE_URI=')) {
          currentEnv = currentEnv.replace(/AIVEN_SERVICE_URI=.*/g, `AIVEN_SERVICE_URI=${inputUri}`);
        } else {
          currentEnv += `\n# Aiven Cloud MySQL Sync URI\nAIVEN_SERVICE_URI=${inputUri}\n`;
        }
        fs.writeFileSync(envPath, currentEnv, 'utf8');
        console.log('✅ Successfully saved to .env! You can now run `npm run db:sync-cloud`.');
      } catch (e) {
        console.log('⚠️ Could not save to .env:', e.message);
      }
    }
  }

  console.log(`\n⏳ Connecting to Aiven MySQL (${connectionConfig.host}:${connectionConfig.port})...`);
  let connection;
  try {
    connection = await mysql.createConnection(connectionConfig);
    console.log('✅ Connected to Aiven Cloud MySQL successfully!');

    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    await connection.query('SET SESSION sql_require_primary_key = 0;');

    console.log(`\n📦 Uploading ${path.basename(masterFile)}...`);
    let sqlContent = fs.readFileSync(masterFile, 'utf8');
    sqlContent = sqlContent.replace(/^USE\s+[^;]+;/gmi, '');
    await connection.query(sqlContent);
    console.log(`  ✅ All tables, properties, annotations, and lots imported successfully!`);

    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('\n🎉 SUCCESS! Aiven Cloud database synchronized completely.\n');
  } catch (error) {
    console.error('\n❌ Error during Aiven database import:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

run();
