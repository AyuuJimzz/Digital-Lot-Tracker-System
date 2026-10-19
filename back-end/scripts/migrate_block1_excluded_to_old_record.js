// back-end/scripts/migrate_block1_excluded_to_old_record.js
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'golden_dragon_corp',
  });

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    console.log('--- MOVING TXN 403-407 TO OLD RECORDS ---');

    const targetTxIds = [403, 404, 405, 406, 407];

    const [res] = await conn.query(
      `UPDATE transactions SET 
         agent_name = 'Old Record', 
         employee_id = NULL, 
         is_date_verified = 0, 
         date_provenance = 'unknown_requires_review', 
         notes = 'Legacy sold record for lot Block 1 Lot EXCLUDED without verified sale date', 
         updated_at = NOW() 
       WHERE transaction_id IN (?)`,
      [targetTxIds]
    );

    console.log(`Updated ${res.affectedRows} transactions to Old Record status.`);

    // Verify state
    const [updated] = await conn.query(
      `SELECT transaction_id, lot_id, agent_name, employee_id, date_provenance, is_date_verified 
       FROM transactions WHERE transaction_id IN (?)`,
      [targetTxIds]
    );
    console.table(updated);

    await conn.commit();
    console.log('🎉 Successfully isolated TXN 403-407 into Old Records catalog!');
  } catch (err) {
    await conn.rollback();
    console.error('❌ Error updating transactions:', err);
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

run().catch(console.error);
