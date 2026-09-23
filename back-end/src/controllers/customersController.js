// controllers/customersController.js
const db = require("../../config/database_connection");
const { sanitizeText, sanitizeEmail, sanitizePhone, sanitizeNotes } = require("../utils/sanitizer");

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
        l.property_id, p.property_name
      FROM customers c
      LEFT JOIN lots l ON c.lot_id = l.lot_id
      LEFT JOIN properties p ON l.property_id = p.property_id
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
        l.property_id, p.property_name
      FROM customers c
      LEFT JOIN lots l ON c.lot_id = l.lot_id
      LEFT JOIN properties p ON l.property_id = p.property_id
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
  if (!email.includes("@")) {
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

  try {
    // Validate required fields
    if (!email || !email.includes("@")) {
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

    // Check if lot exists
    const [lotRows] = await db.query(
      "SELECT lot_id, property_id, lot_number, area_sqm, status, coordinates, pending_since, last_reminder_sent FROM lots WHERE lot_id = ?",
      [id]
    );
    if (lotRows.length === 0) {
      return res.status(404).json({ error: "Lot not found" });
    }

    // Check if customer already exists for this specific lot
    const [existingCustomerForLot] = await db.query(
      `SELECT c.customer_id, c.lot_id, c.full_name, c.contact_number, c.email, c.address,
              c.employee_id, c.customer_status, c.created_at, c.updated_at, l.status as lot_status
       FROM customers c 
       JOIN lots l ON c.lot_id = l.lot_id 
       WHERE c.lot_id = ?`,
      [id]
    );

    // If customer exists for this lot AND lot is still Pending/Sold → update in place
    // If lot was Available (cancelled) — fall through to INSERT a new record
    if (existingCustomerForLot.length > 0) {
      const lotStatus = existingCustomerForLot[0].lot_status;
      if (lotStatus === "Pending" || lotStatus === "Sold") {
        await db.query(
          `UPDATE customers SET 
           full_name = ?, contact_number = ?, email = ?, address = ?, updated_at = NOW() 
           WHERE lot_id = ? AND customer_id = ?`,
          [full_name.trim(), contact_number.trim(), email.trim(), address.trim(), id, existingCustomerForLot[0].customer_id]
        );
        console.log(`👤 [Customer Record Updated] Cust #${existingCustomerForLot[0].customer_id} (${full_name}) for Lot #${id}`);
        res.json({ message: "Customer information updated successfully" });
        return;
      }
    }

    // Check if customer with same email exists (for different lot)
    const [existingCustomerByEmail] = await db.query(
      `SELECT c.customer_id, c.lot_id, c.full_name, c.contact_number, c.email, c.address,
              c.employee_id, c.customer_status, c.created_at, c.updated_at, l.status as lot_status
       FROM customers c 
       JOIN lots l ON c.lot_id = l.lot_id 
       WHERE c.email = ?`,
      [email.trim()]
    );

    if (existingCustomerByEmail.length > 0) {
      const existingCustomer = existingCustomerByEmail[0];

      // If the existing customer's lot is sold, create a new customer record
      if (existingCustomer.lot_status === "Sold") {
        const employeeId = (req.user && req.user.role === "employee") ? req.user.id : null;
        await db.query(
          `INSERT INTO customers (lot_id, full_name, contact_number, email, address, employee_id, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [id, full_name.trim(), contact_number.trim(), email.trim(), address.trim(), employeeId]
        );
        res.json({ message: "New customer record created (previous lot is sold)" });
      } else {
        // Start transaction to handle both customer update and lot status changes
        const connection = await db.getConnection();

        try {
          await connection.beginTransaction();
          const oldLotId = existingCustomer.lot_id;

          // Update the old lot status back to Available
          await connection.query(
            `UPDATE lots SET status = 'Available', pending_since = NULL WHERE lot_id = ?`,
            [oldLotId]
          );

          // Delete old transaction for the previous lot
          await connection.query(`DELETE FROM transactions WHERE lot_id = ?`, [oldLotId]);

          // Update customer to the new lot
          await connection.query(
            `UPDATE customers SET 
             lot_id = ?, full_name = ?, contact_number = ?, email = ?, address = ?, updated_at = NOW() 
             WHERE customer_id = ?`,
            [
              id,
              full_name.trim(),
              contact_number.trim(),
              email.trim(),
              address.trim(),
              existingCustomer.customer_id,
            ]
          );

          // Create new transaction for the new lot
          await connection.query(
            `INSERT INTO transactions (lot_id, customer_id, payment_type, notes)
             VALUES (?, ?, 'No Downpayment', NULL)`,
            [id, existingCustomer.customer_id]
          );

          // Update the new lot status to Pending
          await connection.query(
            `UPDATE lots SET status = 'Pending', pending_since = NOW() WHERE lot_id = ?`,
            [id]
          );

          await connection.commit();
          res.json({ message: "Customer updated to new lot with transaction" });
        } catch (error) {
          try {
            await connection.rollback();
          } catch (rollbackError) {
            console.error("Error rolling back customer update:", rollbackError);
          }
          throw error;
        } finally {
          connection.release();
        }
      }
    } else {
      // No existing customer with this email, create new customer
      await db.query(
        `INSERT INTO customers (lot_id, full_name, contact_number, email, address, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [id, full_name.trim(), contact_number.trim(), email.trim(), address.trim()]
      );
      res.json({ message: "Customer created successfully" });
    }
  } catch (err) {
    console.error("Error in createOrUpdateCustomer:", err);
    res.status(500).json({ error: err.message });
  }
};
