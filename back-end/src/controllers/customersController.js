// controllers/customersController.js
const db = require("../../config/database_connection");

// =======================
// GET ALL CUSTOMERS
// =======================
exports.getAllCustomers = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM customers ORDER BY created_at DESC");
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
    const [rows] = await db.query("SELECT * FROM customers WHERE customer_id = ?", [id]);
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
      `SELECT l.*, p.property_name, p.location 
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
  const { full_name, contact_number, email, address } = req.body;

  // Validation
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
    const [result] = await db.query(
      `INSERT INTO customers 
        (full_name, contact_number, email, address)
       VALUES (?, ?, ?, ?)`,
      [full_name.trim(), contact_number.trim(), email.trim(), address.trim()]
    );

    res.status(201).json({
      message: "Customer added successfully.",
      customer_id: result.insertId,
    });
  } catch (err) {
    console.error("Error in createCustomer:", err);
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
    const [existing] = await db.query("SELECT * FROM customers WHERE customer_id = ?", [id]);
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

    res.json({ message: "Customer updated successfully." });
  } catch (err) {
    console.error("Error in updateCustomer:", err);
    res.status(500).json({ error: err.message });
  }
};

// =======================
// DELETE CUSTOMER
// =======================
exports.deleteCustomer = async (req, res) => {
  const { id } = req.params;
  try {
    const [existing] = await db.query("SELECT * FROM customers WHERE customer_id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    await db.query("DELETE FROM customers WHERE customer_id = ?", [id]);
    res.json({ message: "Customer deleted successfully." });
  } catch (err) {
    console.error("Error in deleteCustomer:", err);
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
    const [lotRows] = await db.query("SELECT * FROM lots WHERE lot_id = ?", [id]);
    if (lotRows.length === 0) {
      return res.status(404).json({ error: "Lot not found" });
    }

    // Check if customer already exists for this lot
    const [existingCustomer] = await db.query("SELECT * FROM customers WHERE lot_id = ?", [id]);

    if (existingCustomer.length > 0) {
      // Update existing customer
      await db.query(
        `UPDATE customers SET 
         full_name = ?, contact_number = ?, email = ?, address = ?, updated_at = NOW() 
         WHERE lot_id = ?`,
        [full_name.trim(), contact_number.trim(), email.trim(), address.trim(), id]
      );
    } else {
      // Create new customer
      await db.query(
        `INSERT INTO customers (lot_id, full_name, contact_number, email, address, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [id, full_name.trim(), contact_number.trim(), email.trim(), address.trim()]
      );
    }

    res.json({ message: "Customer information saved successfully" });
  } catch (err) {
    console.error("Error in createOrUpdateCustomer:", err);
    res.status(500).json({ error: err.message });
  }
};
