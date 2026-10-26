// back-end/scripts/backup_cloud_db.js
// Universal Automated Cloud Database Backup Tool
// Dumps full Aiven Cloud MySQL database into a timestamped, self-contained SQL file
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Enforce Philippine Standard Time (PST, UTC+8) for all backup filenames & timestamps
if (!process.env.TZ) {
  process.env.TZ = 'Asia/Manila';
}

function parseConnectionConfig() {
  const aivenUri = process.env.AIVEN_SERVICE_URI;
  if (aivenUri && aivenUri.trim()) {
    const parsed = new URL(aivenUri.trim().replace(/^['"]|['"]$/g, ''));
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '3306', 10),
      user: decodeURIComponent(parsed.username || 'avnadmin'),
      password: decodeURIComponent(parsed.password || ''),
      database: parsed.pathname.replace(/^\//, '') || 'defaultdb',
      ssl: { rejectUnauthorized: false },
      multipleStatements: true
    };
  }

  const host = process.env.DB_HOST || 'localhost';
  const isCloud = host.includes('aivencloud.com') || process.env.DB_SSL === 'true';

  return {
    host,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'golden_dragon_corp',
    multipleStatements: true,
    ...(isCloud ? { ssl: { rejectUnauthorized: false } } : {})
  };
}

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
  const str = String(val)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n');
  return `'${str}'`;
}

async function backupCloudDatabase() {
  console.log('======================================================');
  console.log('   🐉 GOLDEN DRAGON ESTATE — CLOUD DATABASE BACKUP    ');
  console.log('======================================================\n');

  const config = parseConnectionConfig();
  console.log(`📡 Connecting to Database (${config.host}:${config.port}/${config.database})...`);

  let conn;
  try {
    conn = await mysql.createConnection(config);
    console.log('✅ Connected successfully to Cloud Database!\n');

    const [tablesRes] = await conn.query('SHOW TABLES');
    const existingTables = tablesRes.map((t) => Object.values(t)[0]);

    const coreTablePriority = [
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

    const tablesToDump = [
      ...coreTablePriority.filter((t) => existingTables.includes(t)),
      ...existingTables.filter((t) => !coreTablePriority.includes(t))
    ];

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const monthNames = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    const monthName = monthNames[now.getMonth()];
    const day = pad(now.getDate());
    const year = now.getFullYear();
    const dateReadable = `${monthName}_${day}_${year}`;

    // Normal 12-hour format with am/pm (e.g. 05-24pm)
    const rawHours = now.getHours();
    const ampm = rawHours >= 12 ? 'pm' : 'am';
    const hours12 = pad(rawHours % 12 || 12);
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());

    let timeStr = `${hours12}-${minutes}${ampm}`;
    const latestFilename = `latest_cloud_backup_${dateReadable}.sql`;

    let dumpContent = '';
    dumpContent += `-- ======================================================\n`;
    dumpContent += `-- Golden Dragon Estate Platform — Automated Cloud Backup\n`;
    dumpContent += `-- Generated: ${now.toISOString()}\n`;
    dumpContent += `-- Source Host: ${config.host}:${config.port}\n`;
    dumpContent += `-- Database: ${config.database}\n`;
    dumpContent += `-- ======================================================\n\n`;
    dumpContent += `/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO,ANSI_QUOTES' */;\n`;
    dumpContent += `/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;\n`;
    dumpContent += `SET SESSION sql_require_primary_key = 0;\n\n`;

    const summary = [];
    let totalRows = 0;

    for (const table of tablesToDump) {
      console.log(`📦 Dumping table: \`${table}\`...`);

      const [createRes] = await conn.query(`SHOW CREATE TABLE \`${table}\``);
      const createTableSql = createRes[0]['Create Table'];
      const [rows] = await conn.query(`SELECT * FROM \`${table}\``);

      totalRows += rows.length;
      summary.push({ table, count: rows.length });

      dumpContent += `-- ------------------------------------------------------\n`;
      dumpContent += `-- Table structure for table \`${table}\`\n`;
      dumpContent += `-- ------------------------------------------------------\n`;
      dumpContent += `DROP TABLE IF EXISTS \`${table}\`;\n`;
      dumpContent += `${createTableSql};\n\n`;

      if (rows.length > 0) {
        dumpContent += `-- Dumping data for table \`${table}\` (${rows.length} records)\n`;
        dumpContent += `LOCK TABLES \`${table}\` WRITE;\n`;
        dumpContent += `/*!40000 ALTER TABLE \`${table}\` DISABLE KEYS */;\n`;

        const columns = Object.keys(rows[0]);
        const chunkSize = 100;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const valuesSql = chunk
            .map((row) => `(${columns.map((col) => escapeSqlValue(row[col])).join(', ')})`)
            .join(',\n  ');

          dumpContent += `INSERT INTO \`${table}\` (\`${columns.join('`, `')}\`) VALUES\n  ${valuesSql};\n`;
        }

        dumpContent += `/*!40000 ALTER TABLE \`${table}\` ENABLE KEYS */;\n`;
        dumpContent += `UNLOCK TABLES;\n\n`;
      }
    }

    dumpContent += `/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;\n`;
    dumpContent += `/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;\n`;
    dumpContent += `-- Dump completed on ${new Date().toISOString()}\n`;

    const backupDir = path.resolve(__dirname, '../../database_Backup');
    const snapshotsDir = path.join(backupDir, 'backup_history');

    if (!fs.existsSync(snapshotsDir)) {
      fs.mkdirSync(snapshotsDir, { recursive: true });
    }

    let snapshotFilename = `aiven_backup_${dateReadable}_${timeStr}.sql`;
    let snapshotPath = path.join(snapshotsDir, snapshotFilename);

    // If backup runs again in the same minute, append seconds to avoid collision
    if (fs.existsSync(snapshotPath)) {
      timeStr = `${hours12}-${minutes}-${seconds}${ampm}`;
      snapshotFilename = `aiven_backup_${dateReadable}_${timeStr}.sql`;
      snapshotPath = path.join(snapshotsDir, snapshotFilename);
    }

    const latestPath = path.join(backupDir, latestFilename);

    // Clean up previous latest_cloud_backup*.sql on the outside
    if (fs.existsSync(backupDir)) {
      const oldLatestFiles = fs.readdirSync(backupDir).filter((f) => f.startsWith('latest_cloud_backup') && f.endsWith('.sql'));
      for (const oldFile of oldLatestFiles) {
        try {
          fs.unlinkSync(path.join(backupDir, oldFile));
        } catch (e) {}
      }
    }

    fs.writeFileSync(snapshotPath, dumpContent, 'utf8');
    fs.writeFileSync(latestPath, dumpContent, 'utf8');

    const fileSizeBytes = fs.statSync(snapshotPath).size;
    const fileSizeKb = (fileSizeBytes / 1024).toFixed(2);

    // Snapshot rotation: Keep only the latest 30 snapshots by actual file modification time (30-day retention)
    const MAX_SNAPSHOTS = 30;
    const existingSnapshots = fs
      .readdirSync(snapshotsDir)
      .filter((file) => file.startsWith('aiven_backup_') && file.endsWith('.sql'))
      .map((file) => ({
        file,
        mtime: fs.statSync(path.join(snapshotsDir, file)).mtimeMs
      }))
      .sort((a, b) => a.mtime - b.mtime)
      .map((item) => item.file);

    if (existingSnapshots.length > MAX_SNAPSHOTS) {
      const toDelete = existingSnapshots.slice(0, existingSnapshots.length - MAX_SNAPSHOTS);
      for (const oldFile of toDelete) {
        fs.unlinkSync(path.join(snapshotsDir, oldFile));
        console.log(`🧹 Pruned old snapshot: ${oldFile}`);
      }
    }

    console.log('\n======================================================');
    console.log('🎉 CLOUD DATABASE BACKUP COMPLETED SUCCESSFULLY!');
    console.log('======================================================');
    console.log(`📁 Snapshot:  ${snapshotPath}`);
    console.log(`📄 Latest:    ${latestPath}`);
    console.log(`📊 File Size: ${fileSizeKb} KB (${fileSizeBytes} bytes)`);
    console.log(`🔢 Total:     ${totalRows} records across ${tablesToDump.length} tables\n`);

    console.table(summary);

    return {
      success: true,
      snapshotPath,
      latestPath,
      fileSizeBytes,
      totalRows,
      tableCount: tablesToDump.length,
      summary
    };
  } catch (error) {
    console.error('❌ Cloud Database Backup Error:', error.message);
    if (process.exitCode !== undefined) process.exitCode = 1;
    throw error;
  } finally {
    if (conn) await conn.end();
  }
}

if (require.main === module) {
  backupCloudDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { backupCloudDatabase };
