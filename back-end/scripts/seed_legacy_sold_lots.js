// back-end/scripts/seed_legacy_sold_lots.js
/**
 * Idempotent, Production-Ready Seed Script for Legacy Sold Lots
 * Golden Dragon Estate Platform
 *
 * Source: Official Client Inventory PDFs (Abilay Norte & Pulo Maestra Bita)
 * Attributes all sales to 'Old Record' (agent_status: 'legacy', employee_id: null).
 * Date provenance is set to 'unknown_requires_review' with is_date_verified = 0.
 * Customer contacts set to 'To be updated' for client self-service on turnover.
 */

const fs = require('fs');
const path = require('path');
const db = require('../config/database_connection');

const abilaySold = fs.existsSync(path.join(__dirname, 'data', 'abilay_sold.json'))
  ? require('./data/abilay_sold.json')
  : require('../../scratch/abilay_sold.json');
const puloSold = fs.existsSync(path.join(__dirname, 'data', 'pulo_sold.json'))
  ? require('./data/pulo_sold.json')
  : require('../../scratch/pulo_sold.json');

const isLive = process.argv.includes('--live') || process.argv.includes('--cloud');

async function seedLegacySoldLots() {
  console.log(`🚀 [Starting Legacy Sold Lots Ingestion - ${isLive ? 'LIVE (Aiven Cloud)' : 'LOCAL (localhost)'}]...\n`);

  let connection;
  if (isLive) {
    const mysql = require('mysql2/promise');
    const envPath = path.join(__dirname, '..', '..', '.env');
    require('dotenv').config({ path: envPath });
    const aivenUri = process.env.AIVEN_SERVICE_URI;
    if (!aivenUri) throw new Error('AIVEN_SERVICE_URI is not defined in .env');
    const parsed = new URL(aivenUri.trim().replace(/^['"]|['"]$/g, ''));
    const cfg = {
      host: parsed.hostname,
      port: parseInt(parsed.port || '3306'),
      user: decodeURIComponent(parsed.username || 'avnadmin'),
      password: decodeURIComponent(parsed.password || ''),
      database: parsed.pathname.replace(/^\//, '') || 'defaultdb',
      ssl: { rejectUnauthorized: false }
    };
    connection = await mysql.createConnection(cfg);
  } else {
    connection = await db.getConnection();
  }

  await connection.beginTransaction();

  try {
    // 1. Fetch active lots for Property 49 (Abilay) and Property 50 (Pulo)
    const [p49Lots] = await connection.query(
      'SELECT lot_id, property_id, lot_number, status FROM lots WHERE property_id = 49'
    );
    const [p50Lots] = await connection.query(
      'SELECT lot_id, property_id, lot_number, status FROM lots WHERE property_id = 50'
    );

    const p49Map = new Map();
    p49Lots.forEach(l => p49Map.set(l.lot_number.toLowerCase().trim(), l));

    const p50Map = new Map();
    p50Lots.forEach(l => p50Map.set(l.lot_number.toLowerCase().trim(), l));

    console.log(`📌 Found in DB: ${p49Lots.length} lots for Abilay (P49), ${p50Lots.length} lots for Pulo (P50)\n`);

    // 2. Prepare items to insert
    const queue = [];

    // Map Abilay Sold
    for (const item of abilaySold) {
      const lotName = `Block ${item.block} Lot ${item.lot}`.toLowerCase();
      const match = p49Map.get(lotName);
      if (match) {
        queue.push({
          lot_id: match.lot_id,
          lot_number: match.lot_number,
          property_id: 49,
          buyer_name: item.name.trim()
        });
      }
    }

    // Map Pulo Sold (including reconciled Block 17 and 16 polygons)
    for (const item of puloSold) {
      let lotName = `Block ${item.block} Lot ${item.lot}`.toLowerCase();
      if (item.block === 17) {
        lotName = `block 1 lot ${10 + item.lot}`;
      } else if (item.block === 16) {
        if (item.lot === 1) lotName = 'block 1 lot 38';
        if (item.lot === 3) lotName = 'block 1 lot 41';
      }

      const match = p50Map.get(lotName);
      if (match) {
        queue.push({
          lot_id: match.lot_id,
          lot_number: match.lot_number,
          property_id: 50,
          buyer_name: item.name.trim()
        });
      }
    }

    console.log(`📋 Total Verified Sold Lots to Ingest: ${queue.length}`);
    console.log(`   - Abilay (P49): ${queue.filter(q => q.property_id === 49).length}`);
    console.log(`   - Pulo (P50):   ${queue.filter(q => q.property_id === 50).length}\n`);

    let insertedCustomers = 0;
    let updatedLots = 0;
    let insertedTransactions = 0;

    for (const item of queue) {
      // Check if legacy customer already exists for this lot
      const [existingCust] = await connection.query(
        'SELECT customer_id FROM customers WHERE lot_id = ? ORDER BY customer_id DESC LIMIT 1',
        [item.lot_id]
      );

      let customerId = null;

      if (existingCust.length > 0) {
        customerId = existingCust[0].customer_id;
        // Update existing customer info
        await connection.query(
          `UPDATE customers SET 
            full_name = ?, contact_number = 'To be updated', 
            email = 'To be updated', address = 'To be updated', 
            customer_status = 'Sold', employee_id = NULL, updated_at = NOW()
           WHERE customer_id = ?`,
          [item.buyer_name, customerId]
        );
      } else {
        // Insert new customer
        const [custRes] = await connection.query(
          `INSERT INTO customers 
            (lot_id, full_name, contact_number, email, address, customer_status, employee_id, created_at, updated_at)
           VALUES (?, ?, 'To be updated', 'To be updated', 'To be updated', 'Sold', NULL, NOW(), NOW())`,
          [item.lot_id, item.buyer_name]
        );
        customerId = custRes.insertId;
        insertedCustomers++;
      }

      // Update lot status to Sold
      await connection.query(
        `UPDATE lots SET 
          status = 'Sold', sold_on = NULL, pending_since = NULL, last_reminder_sent = NULL 
         WHERE lot_id = ?`,
        [item.lot_id]
      );
      updatedLots++;

      // Check if transaction already exists for this lot & customer
      const [existingTxn] = await connection.query(
        'SELECT transaction_id FROM transactions WHERE lot_id = ? AND customer_id = ? LIMIT 1',
        [item.lot_id, customerId]
      );

      if (existingTxn.length > 0) {
        await connection.query(
          `UPDATE transactions SET 
            payment_type = 'Cash', 
            notes = ?, 
            employee_id = NULL, 
            agent_name = 'Old Record', 
            is_date_verified = 0, 
            date_provenance = 'unknown_requires_review'
           WHERE transaction_id = ?`,
          [
            `Legacy sold record for lot ${item.lot_number} without verified sale date`,
            existingTxn[0].transaction_id
          ]
        );
      } else {
        await connection.query(
          `INSERT INTO transactions 
            (lot_id, customer_id, transaction_date, payment_type, notes, employee_id, agent_name, is_date_verified, date_provenance, created_at, updated_at)
           VALUES (?, ?, NOW(), 'Cash', ?, NULL, 'Old Record', 0, 'unknown_requires_review', NOW(), NOW())`,
          [
            item.lot_id,
            customerId,
            `Legacy sold record for lot ${item.lot_number} without verified sale date`
          ]
        );
        insertedTransactions++;
      }
    }

    await connection.commit();
    console.log('🎉 [Migration Successful!]');
    console.log(`   - Customers Created:     ${insertedCustomers}`);
    console.log(`   - Lots Marked Sold:      ${updatedLots}`);
    console.log(`   - Transactions Recorded: ${insertedTransactions}`);
    console.log('\n✅ All changes committed to the database.');
  } catch (err) {
    await connection.rollback();
    console.error('❌ [Migration Failed - Rolled Back]:', err);
    throw err;
  } finally {
    if (connection) {
      if (isLive) {
        await connection.end();
      } else {
        connection.release();
      }
    }
    process.exit(0);
  }
}

seedLegacySoldLots().catch(() => process.exit(1));
