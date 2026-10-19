// back-end/scripts/update_block2_sold.js
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BLOCK_2_BUYERS = [
  { lot: 1,  name: 'CARL PATRICK SALVERON',                     area: 140.00, status: 'Sold' },
  { lot: 2,  name: 'IAN NIEL A. SALVERON',                      area: 110.00, status: 'Sold' },
  { lot: 3,  name: 'ROBERT KENDRICK B. VILLAREAL',              area: 110.00, status: 'Sold' },
  { lot: 4,  name: 'ASANE ALLAN CHRISTOPHER ARIAS',             area: 110.00, status: 'Sold' },
  { lot: 5,  name: 'MIA FLOR G. VEDRA & FRENCH LAR G. GAJO',    area: 110.00, status: 'Sold' },
  { lot: 6,  name: 'GEMMA CASORLA',                             area: 110.00, status: 'Sold' },
  { lot: 7,  name: 'HOLD FOR MAAM ANNIE',                       area: 110.00, status: 'Sold' },
  { lot: 8,  name: 'SPS EVER G. REGACHO & GIOVANNI A. REGACHO', area: 110.00, status: 'Sold' },
  { lot: 9,  name: 'GEMMA CASORLA',                             area: 110.00, status: 'Sold' },
  { lot: 10, name: 'GEMMA CASORLA',                             area: 110.00, status: 'Sold' },
  { lot: 11, name: null,                                        area: 110.00, status: 'Available' },
  { lot: 12, name: 'JOHN WHITEHOUSE',                           area: 110.00, status: 'Sold' },
  { lot: 13, name: null,                                        area: 110.00, status: 'Available' },
  { lot: 14, name: 'SPS MARK ANTHONY S. TING MILKCA MAE L. TING', area: 140.00, status: 'Sold' }
];

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
    console.log('--- UPDATING BLOCK 2 LOTS, CUSTOMERS, AND TRANSACTIONS ---');

    for (const item of BLOCK_2_BUYERS) {
      const lotNumberPattern = `Block 2 Lot ${item.lot}`;
      
      // Find lot
      const [lots] = await conn.query(
        `SELECT lot_id, lot_number, area_sqm, status FROM lots 
         WHERE property_id = 49 AND (LOWER(lot_number) = LOWER(?)) LIMIT 1`,
        [lotNumberPattern]
      );

      if (lots.length === 0) {
        console.warn(`⚠️ Lot not found: ${lotNumberPattern}`);
        continue;
      }

      const lot = lots[0];
      const standardLotNumber = `Block 2 Lot ${item.lot}`;

      // 1. Update lot attributes (normalized name, standard area, status)
      await conn.query(
        `UPDATE lots SET 
           lot_number = ?, 
           area_sqm = ?, 
           status = ?, 
           sold_on = CASE WHEN ? = 'Sold' THEN COALESCE(sold_on, CURDATE()) ELSE NULL END,
           pending_since = NULL, 
           last_reminder_sent = NULL 
         WHERE lot_id = ?`,
        [standardLotNumber, item.area, item.status, item.status, lot.lot_id]
      );

      if (item.status === 'Sold' && item.name) {
        // 2. Customer
        const [existingCusts] = await conn.query(
          `SELECT customer_id, full_name FROM customers WHERE lot_id = ? ORDER BY customer_id DESC LIMIT 1`,
          [lot.lot_id]
        );

        let customerId;
        if (existingCusts.length > 0) {
          customerId = existingCusts[0].customer_id;
          await conn.query(
            `UPDATE customers SET 
               full_name = ?, 
               contact_number = 'To be updated', 
               email = 'To be updated', 
               address = 'To be updated', 
               customer_status = 'Sold', 
               employee_id = NULL, 
               updated_at = NOW() 
             WHERE customer_id = ?`,
            [item.name, customerId]
          );
        } else {
          const [ins] = await conn.query(
            `INSERT INTO customers 
               (lot_id, full_name, contact_number, email, address, customer_status, employee_id, created_at, updated_at) 
             VALUES (?, ?, 'To be updated', 'To be updated', 'To be updated', 'Sold', NULL, NOW(), NOW())`,
            [lot.lot_id, item.name]
          );
          customerId = ins.insertId;
        }

        // 3. Transaction
        const [existingTx] = await conn.query(
          `SELECT transaction_id FROM transactions WHERE lot_id = ? LIMIT 1`,
          [lot.lot_id]
        );

        if (existingTx.length > 0) {
          await conn.query(
            `UPDATE transactions SET 
               customer_id = ?, 
               payment_type = 'Cash', 
               notes = ?, 
               employee_id = NULL, 
               agent_name = 'Old Record', 
               is_date_verified = 0, 
               date_provenance = 'unknown_requires_review', 
               updated_at = NOW() 
             WHERE transaction_id = ?`,
            [
              customerId,
              `Legacy sold record for lot ${standardLotNumber} without verified sale date`,
              existingTx[0].transaction_id
            ]
          );
        } else {
          await conn.query(
            `INSERT INTO transactions 
               (lot_id, customer_id, transaction_date, payment_type, notes, employee_id, agent_name, is_date_verified, date_provenance, created_at, updated_at) 
             VALUES (?, ?, NOW(), 'Cash', ?, NULL, 'Old Record', 0, 'unknown_requires_review', NOW(), NOW())`,
            [
              lot.lot_id,
              customerId,
              `Legacy sold record for lot ${standardLotNumber} without verified sale date`
            ]
          );
        }

        console.log(`✅ [${standardLotNumber}] (lot_id: ${lot.lot_id}) -> Sold to: ${item.name}`);
      } else {
        console.log(`ℹ️ [${standardLotNumber}] (lot_id: ${lot.lot_id}) -> Available (vacant)`);
      }
    }

    await conn.commit();
    console.log('\n🎉 Block 2 updates successfully committed!');
  } catch (err) {
    await conn.rollback();
    console.error('❌ Error updating Block 2:', err);
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

run().catch(console.error);
