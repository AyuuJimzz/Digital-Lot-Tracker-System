// controllers/clientsController.js
const db = require("../../config/database_connection");

// =======================
// GET ALL CLIENTS
// =======================
exports.getAllClients = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM clients ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error("Error in getAllClients:", err);
    res.status(500).json({ error: err.message });
  }
};

// =======================
// GET CLIENT BY ID
// =======================
exports.getClientById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      "SELECT * FROM clients WHERE client_id = ?",
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Client not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("Error in getClientById:", err);
    res.status(500).json({ error: err.message });
  }
};

// =======================
// CREATE CLIENT
// =======================
exports.createClient = async (req, res) => {
  const {
    full_name,
    contact_number,
    email,
    address,
    valid_id_type,
    valid_id_number,
  } = req.body;

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
    // Get the employee ID from session if available
    const created_by = req.session?.user?.id || null;

    const [result] = await db.query(
      `INSERT INTO clients 
        (full_name, contact_number, email, address, valid_id_type, valid_id_number, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        full_name.trim(),
        contact_number.trim(),
        email.trim(),
        address.trim(),
        valid_id_type?.trim() || null,
        valid_id_number?.trim() || null,
        created_by,
      ]
    );

    res.status(201).json({
      message: "Client added successfully.",
      client_id: result.insertId,
    });
  } catch (err) {
    console.error("Error in createClient:", err);
    res.status(500).json({ error: err.message });
  }
};

// =======================
// UPDATE CLIENT
// =======================
exports.updateClient = async (req, res) => {
  const { id } = req.params;
  const {
    full_name,
    contact_number,
    email,
    address,
    valid_id_type,
    valid_id_number,
  } = req.body;

  try {
    const [existing] = await db.query(
      "SELECT * FROM clients WHERE client_id = ?",
      [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: "Client not found" });
    }

    await db.query(
      `UPDATE clients SET
        full_name = ?,
        contact_number = ?,
        email = ?,
        address = ?,
        valid_id_type = ?,
        valid_id_number = ?,
        updated_at = NOW()
       WHERE client_id = ?`,
      [
        full_name?.trim() || existing[0].full_name,
        contact_number?.trim() || existing[0].contact_number,
        email?.trim() || existing[0].email,
        address?.trim() || existing[0].address,
        valid_id_type?.trim() || existing[0].valid_id_type,
        valid_id_number?.trim() || existing[0].valid_id_number,
        id,
      ]
    );

    res.json({ message: "Client updated successfully." });
  } catch (err) {
    console.error("Error in updateClient:", err);
    res.status(500).json({ error: err.message });
  }
};

// =======================
// DELETE CLIENT
// =======================
exports.deleteClient = async (req, res) => {
  const { id } = req.params;
  try {
    const [existing] = await db.query(
      "SELECT * FROM clients WHERE client_id = ?",
      [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: "Client not found" });
    }

    await db.query("DELETE FROM clients WHERE client_id = ?", [id]);
    res.json({ message: "Client deleted successfully." });
  } catch (err) {
    console.error("Error in deleteClient:", err);
    res.status(500).json({ error: err.message });
  }
};
