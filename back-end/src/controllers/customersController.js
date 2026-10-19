// controllers/customersController.js
const db = require("../../config/database_connection");
const { sanitizeText, sanitizeEmail, sanitizePhone, sanitizeNotes } = require("../utils/sanitizer");
const { isNonSaleableLot } = require("../utils/lotClassification");

// =======================
// GET ALL CUSTOMERS (For Map/Dashboard — unfiltered, all employees)
// =======================
exports.getAllCustomersForMap = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.customer_id, c.lot_id, c.full_name, c.contact_number, c.email, c.address,
        c.employee_id, c.created_at, c.updated_at, l.lot_number, l.area_sqm,
        CASE 
          WHEN l.status = 'Available' AND (c.customer_status IS NULL OR c.customer_status != 'Sold') THEN 'Cancelled'
          ELSE COALESCE(c.customer_status, l.status)
        END as lot_status, 
        l.property_id, p.property_name,
        CASE WHEN l.status = 'Available' AND (c.customer_status IS NULL OR c.customer_status != 'Sold') THEN NULL ELSE t.payment_type END AS payment_type,
        CASE WHEN l.status = 'Available' AND (c.customer_status IS NULL OR c.customer_status != 'Sold') THEN NULL ELSE t.total_contract_price END AS total_contract_price,
        CASE WHEN l.status = 'Available' AND (c.customer_status IS NULL OR c.customer_status != 'Sold') THEN NULL ELSE t.downpayment END AS downpayment,
        CASE WHEN l.status = 'Available' AND (c.customer_status IS NULL OR c.customer_status != 'Sold') THEN NULL ELSE t.terms_months END AS terms_months,
        CASE WHEN l.status = 'Available' AND (c.customer_status IS NULL OR c.customer_status != 'Sold') THEN NULL ELSE t.monthly_amortization END AS monthly_amortization
      FROM customers c
      LEFT JOIN lots l ON c.lot_id = l.lot_id
      LEFT JOIN properties p ON l.property_id = p.property_id
      LEFT JOIN (
        SELECT lot_id, customer_id, payment_type, total_contract_price, downpayment, terms_months, monthly_amortization,
               ROW_NUMBER() OVER (PARTITION BY lot_id, customer_id ORDER BY transaction_date DESC, transaction_id DESC) AS rn
        FROM transactions
        WHERE lot_id IS NOT NULL AND customer_id IS NOT NULL AND payment_type NOT IN ('Reversal', 'Cancelled')
      ) t ON c.lot_id = t.lot_id AND c.customer_id = t.customer_id AND t.rn = 1
      ORDER BY c.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Error in getAllCustomersForMap:", err);
    res.status(500).json({ error: err.message });
  }
};

// =======================
// GET ALL CUSTOMERS (Employee-filtered for My Clients)
// =======================
exports.getAllCustomers = async (req, res) => {
  try {
    let query = `
      SELECT c.customer_id, c.lot_id, c.full_name, c.contact_number, c.email, c.address,
        c.employee_id, c.created_at, c.updated_at, l.lot_number, l.area_sqm,
        CASE 
          WHEN l.status = 'Available' AND (c.customer_status IS NULL OR c.customer_status != 'Sold') THEN 'Cancelled'
          ELSE COALESCE(c.customer_status, l.status)
        END as lot_status, 
        l.property_id, p.property_name,
        CASE WHEN l.status = 'Available' AND (c.customer_status IS NULL OR c.customer_status != 'Sold') THEN NULL ELSE t.payment_type END AS payment_type,
        CASE WHEN l.status = 'Available' AND (c.customer_status IS NULL OR c.customer_status != 'Sold') THEN NULL ELSE t.total_contract_price END AS total_contract_price,
        CASE WHEN l.status = 'Available' AND (c.customer_status IS NULL OR c.customer_status != 'Sold') THEN NULL ELSE t.downpayment END AS downpayment,
        CASE WHEN l.status = 'Available' AND (c.customer_status IS NULL OR c.customer_status != 'Sold') THEN NULL ELSE t.terms_months END AS terms_months,
        CASE WHEN l.status = 'Available' AND (c.customer_status IS NULL OR c.customer_status != 'Sold') THEN NULL ELSE t.monthly_amortization END AS monthly_amortization
      FROM customers c
      LEFT JOIN lots l ON c.lot_id = l.lot_id
      LEFT JOIN properties p ON l.property_id = p.property_id
      LEFT JOIN (
        SELECT lot_id, customer_id, payment_type, total_contract_price, downpayment, terms_months, monthly_amortization,
               ROW_NUMBER() OVER (PARTITION BY lot_id, customer_id ORDER BY transaction_date DESC, transaction_id DESC) AS rn
        FROM transactions
        WHERE lot_id IS NOT NULL AND customer_id IS NOT NULL AND payment_type NOT IN ('Reversal', 'Cancelled')
      ) t ON c.lot_id = t.lot_id AND c.customer_id = t.customer_id AND t.rn = 1
    `;
    const params = [];
    if (req.user && req.user.role === "employee") {
      query += ` WHERE c.employee_id = ? `;
      params.push(req.user.id);
    }
    query += ` ORDER BY c.created_at DESC`;
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error("Error in getAllCustomers:", err);
    res.status(500).json({ error: err.message });
  }
};

// =======================
// GET CUSTOMER BY ID
// =======================
exports.getCustomerById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      "SELECT customer_id, lot_id, full_name, contact_number, email, address, employee_id, customer_status, created_at, updated_at FROM customers WHERE customer_id = ?",
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("Error in getCustomerById:", err);
    res.status(500).json({ error: err.message });
  }
};

// =======================
// GET LOT WITH CUSTOMER
// =======================
exports.getLotWithCustomer = async (req, res) => {
  const { id } = req.params;

  try {
    // Get lot details
    const [lotRows] = await db.query(
      `SELECT l.lot_id, l.property_id, l.lot_number, l.area_sqm, l.status, l.coordinates,
              l.pending_since, l.last_reminder_sent, p.property_name, p.location
       FROM lots l 
       LEFT JOIN properties p ON l.property_id = p.property_id 
       WHERE l.lot_id = ?`,
      [id]
    );

    if (lotRows.length === 0) {
      return res.status(404).json({ error: "Lot not found" });
    }

    const lot = lotRows[0];

    // Get customer information for this lot
    const [customerRows] = await db.query(
      `SELECT customer_id, full_name, contact_number, email, address, created_at, updated_at 
       FROM customers 
       WHERE lot_id = ?`,
      [id]
    );

    const result = {
      ...lot,
      coordinates:
        typeof lot.coordinates === "string" ? JSON.parse(lot.coordinates) : lot.coordinates,
      customer: customerRows.length > 0 ? customerRows[0] : null,
    };

    res.json(result);
  } catch (err) {
    console.error("Error in getLotWithCustomer:", err);
    res.status(500).json({ error: err.message });
  }
};

// =======================
// CREATE CUSTOMER
// =======================
exports.createCustomer = async (req, res) => {
  const { lot_id, full_name, contact_number, email, address } = req.body;

  // Validation
  if (!Number.isInteger(Number(lot_id)) || Number(lot_id) <= 0) {
    return res.status(400).json({ message: "A valid lot ID is required." });
  }
  if (!full_name?.trim()) {
    return res.status(400).json({ message: "Full name is required." });
  }
  if (!contact_number?.trim()) {
    return res.status(400).json({ message: "Contact number is required." });
  }
  if (!email?.trim()) {
    return res.status(400).json({ message: "Email is required." });
  }
  if (email.trim() !== "To be updated" && !email.includes("@")) {
    return res.status(400).json({ message: "Please provide a valid email address." });
  }
  if (!address?.trim()) {
    return res.status(400).json({ message: "Address is required." });
  }

  try {
    const employeeId = (req.user && req.user.role === "employee") ? req.user.id : null;
    const [result] = await db.query(
      `INSERT INTO customers 
        (lot_id, full_name, contact_number, email, address, employee_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [lot_id, full_name.trim(), contact_number.trim(), email.trim(), address.trim(), employeeId]
    );

    console.log(`👤 [New Customer Added] ID #${result.insertId} | "${full_name.trim()}" (${email.trim()})`);
    res.status(201).json({
      message: "Customer added successfully.",
      customer_id: result.insertId,
    });
  } catch (err) {
    console.error("❌ [Create Customer Error]:", err);
    res.status(500).json({ error: err.message });
  }
};

// =======================
// UPDATE CUSTOMER
// =======================
exports.updateCustomer = async (req, res) => {
  const { id } = req.params;
  const { full_name, contact_number, email, address } = req.body;

  try {
    const [existing] = await db.query(
      "SELECT customer_id, lot_id, full_name, contact_number, email, address, employee_id, customer_status, created_at, updated_at FROM customers WHERE customer_id = ?",
      [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    if (existing[0].employee_id && req.user?.role !== "admin" && Number(existing[0].employee_id) !== Number(req.user?.id)) {
      return res.status(403).json({ error: "Only the reserving agent or an Admin can update this customer's details." });
    }

    await db.query(
      `UPDATE customers SET
        full_name = ?,
        contact_number = ?,
        email = ?,
        address = ?,
        updated_at = NOW()
       WHERE customer_id = ?`,
      [
        full_name?.trim() || existing[0].full_name,
        contact_number?.trim() || existing[0].contact_number,
        email?.trim() || existing[0].email,
        address?.trim() || existing[0].address,
        id,
      ]
    );

    console.log(`👤 [Customer Updated] ID #${id} | "${full_name?.trim() || existing[0].full_name}"`);
    res.json({ message: "Customer updated successfully." });
  } catch (err) {
    console.error(`❌ [Update Customer Error] ID #${id}:`, err);
    res.status(500).json({ error: err.message });
  }
};

// =======================
// DELETE CUSTOMER
// =======================
exports.deleteCustomer = async (req, res) => {
  const { id } = req.params;
  try {
    const [existing] = await db.query(
      "SELECT customer_id, lot_id, full_name, contact_number, email, address, employee_id, customer_status, created_at, updated_at FROM customers WHERE customer_id = ?",
      [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    await db.query("DELETE FROM customers WHERE customer_id = ?", [id]);
    console.log(`🗑️ [Customer Deleted] ID #${id} (${existing[0].full_name})`);
    res.json({ message: "Customer deleted successfully." });
  } catch (err) {
    console.error(`❌ [Delete Customer Error] ID #${id}:`, err);
    res.status(500).json({ error: err.message });
  }
};

// =======================
// CREATE/UPDATE CUSTOMER FOR LOT
// =======================
exports.createOrUpdateCustomer = async (req, res) => {
  const { id } = req.params;
  const { full_name, contact_number, email, address } = req.body;
  const dbToUse = req?.db || db;
  let connection;

  try {
    // Validate required fields
    if (!email || (email.trim() !== "To be updated" && !email.includes("@"))) {
      return res.status(400).json({ error: "Valid email is required" });
    }
    if (!full_name?.trim()) {
      return res.status(400).json({ error: "Full name is required" });
    }
    if (!contact_number?.trim()) {
      return res.status(400).json({ error: "Contact number is required" });
    }
    if (!address?.trim()) {
      return res.status(400).json({ error: "Address is required" });
    }

    // Atomic transaction across all branches
    connection = await dbToUse.getConnection();
    await connection.beginTransaction();
    const query = (...args) => connection.query(...args);

    // Row-lock target lot and validate saleability inside transaction
    const [lotRows] = await query(
      "SELECT lot_id, property_id, lot_number, area_sqm, status, is_non_saleable, coordinates, pending_since, last_reminder_sent FROM lots WHERE lot_id = ? FOR UPDATE",
      [id]
    );
    if (lotRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Lot not found" });
    }

    const lot = lotRows[0];

    // Zero-Trust Guard: Customers can NEVER be assigned to non-saleable lots
    if (isNonSaleableLot(lot)) {
      await connection.rollback();
      return res.status(400).json({
        error: "Customers cannot be assigned to non-saleable lots (parks, amenities, facilities, or excluded areas).",
      });
    }

    if (lot.status === "Sold" && req.user?.role !== "admin") {
      await connection.rollback();
      return res.status(403).json({ error: "Only Admins can modify customer details on a sold lot." });
    }

    // Check if customer already exists for this specific lot
    const [existingCustomerForLot] = await query(
      `SELECT c.customer_id, c.lot_id, c.full_name, c.contact_number, c.email, c.address,
              c.employee_id, c.customer_status, c.created_at, c.updated_at, l.status as lot_status
       FROM customers c 
       JOIN lots l ON c.lot_id = l.lot_id 
       WHERE c.lot_id = ?
         AND (l.status = 'Available' OR c.customer_status = l.status
              OR (l.status = 'Pending' AND c.customer_status IS NULL))
       ORDER BY CASE
         WHEN c.customer_status = l.status OR (l.status = 'Pending' AND c.customer_status IS NULL) THEN 0
         ELSE 1
       END, c.updated_at DESC, c.customer_id DESC
       LIMIT 1 FOR UPDATE`,
      [id]
    );

    // Branch 1: If customer exists for this lot AND lot is still Pending/Sold → update in place under lock
    if (existingCustomerForLot.length > 0) {
      const lotStatus = existingCustomerForLot[0].lot_status;
      if (lotStatus === "Pending" || lotStatus === "Sold") {
        if (lotStatus === "Sold" && req.user?.role !== "admin") {
          await connection.rollback();
          return res.status(403).json({ error: "Only Admins can modify customer details on a sold lot." });
        }
        if (req.user?.role !== "admin" && Number(existingCustomerForLot[0].employee_id) !== Number(req.user?.id)) {
          await connection.rollback();
          return res.status(403).json({ error: "Only the reserving agent or an Admin can update this customer's details." });
        }
        await query(
          `UPDATE customers SET 
           full_name = ?, contact_number = ?, email = ?, address = ?, updated_at = NOW() 
           WHERE lot_id = ? AND customer_id = ?`,
          [full_name.trim(), contact_number.trim(), email.trim(), address.trim(), id, existingCustomerForLot[0].customer_id]
        );
        await connection.commit();
        console.log(`👤 [Customer Record Updated] Cust #${existingCustomerForLot[0].customer_id} (${full_name}) for Lot #${id}`);
        return res.json({ message: "Customer information updated successfully" });
      }
    }

    // Only an active reservation on another lot can be transferred. Historical
    // Sold/Cancelled customer rows must stay attached to their original lots.
    const [existingCustomerByEmail] = await query(
      `SELECT c.customer_id, c.lot_id, c.full_name, c.contact_number, c.email, c.address,
              c.employee_id, c.customer_status, c.created_at, c.updated_at, l.status as lot_status
       FROM customers c 
       JOIN lots l ON c.lot_id = l.lot_id 
       WHERE c.email = ? AND c.lot_id <> ? AND l.status = 'Pending'
         AND (c.customer_status = 'Pending' OR c.customer_status IS NULL)
       ORDER BY c.updated_at DESC, c.customer_id DESC
       LIMIT 1 FOR UPDATE`,
      [email.trim(), id]
    );

    if (existingCustomerByEmail.length > 0) {
      const existingCustomer = existingCustomerByEmail[0];

      if (req.user?.role !== "admin" && Number(existingCustomer.employee_id) !== Number(req.user?.id)) {
        await connection.rollback();
        return res.status(403).json({ error: "Only the reserving agent or an Admin can transfer this customer." });
      }

      if (lot.status !== "Available") {
        await connection.rollback();
        return res.status(400).json({ error: "Target lot must be Available for a reservation transfer." });
      }

      const oldLotId = existingCustomer.lot_id;
      const [oldLotRows] = await query("SELECT status FROM lots WHERE lot_id = ? FOR UPDATE", [oldLotId]);
      if (oldLotRows[0]?.status !== "Pending") {
        await connection.rollback();
        return res.status(409).json({ error: "The previous reservation is no longer Pending." });
      }

      const [oldTransactionRows] = await query(
        "SELECT agent_name FROM transactions WHERE customer_id = ? ORDER BY transaction_date DESC, transaction_id DESC LIMIT 1",
        [existingCustomer.customer_id]
      );

      // Preserve the old customer and transaction rows as cancelled history.
      const [cancelled] = await query(
        "UPDATE customers SET customer_status = 'Cancelled', updated_at = NOW() WHERE customer_id = ? AND (customer_status = 'Pending' OR customer_status IS NULL)",
        [existingCustomer.customer_id]
      );
      if (cancelled.affectedRows !== 1) {
        await connection.rollback();
        return res.status(409).json({ error: "The previous reservation has already changed." });
      }
      await query("UPDATE lots SET status = 'Available', pending_since = NULL, last_reminder_sent = NULL WHERE lot_id = ?", [oldLotId]);

      const [newCustomer] = await query(
        `INSERT INTO customers (lot_id, full_name, contact_number, email, address, employee_id, customer_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'Pending', NOW(), NOW())`,
        [id, full_name.trim(), contact_number.trim(), email.trim(), address.trim(), existingCustomer.employee_id]
      );
      await query(
        `INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, agent_name)
         VALUES (?, ?, 'No Downpayment', ?, ?, ?)`,
        [id, newCustomer.insertId, `Reservation transferred from lot #${oldLotId}`, existingCustomer.employee_id, oldTransactionRows[0]?.agent_name || null]
      );

      // Update the new lot status to Pending
      await query(
        "UPDATE lots SET status = 'Pending', pending_since = NOW(), last_reminder_sent = NULL WHERE lot_id = ?",
        [id]
      );

      await connection.commit();
      return res.json({ message: "Customer updated to new lot with transaction" });
    }

    // No active reservation to move: create a fresh customer record. Sold and
    // cancelled records with the same email remain untouched as history.
    const employeeId = req.user?.role === "employee" ? req.user.id : null;
    await query(
      `INSERT INTO customers (lot_id, full_name, contact_number, email, address, employee_id, customer_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, full_name.trim(), contact_number.trim(), email.trim(), address.trim(), employeeId, lot.status === "Sold" ? "Sold" : "Pending"]
    );
    await connection.commit();
    res.json({ message: "Customer created successfully" });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Error rolling back customer operation:", rollbackError);
      }
    }
    console.error("Error in createOrUpdateCustomer:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};
