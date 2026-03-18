// controllers/propertyController.js
const db = require("../../config/database_connection");

// ============================================================
// GET ALL PROPERTIES - View all properties
// ============================================================
exports.getAllProperties = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM properties ORDER BY created_at DESC",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GET SINGLE PROPERTY - View property details
// ============================================================
exports.getPropertyById = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      "SELECT * FROM properties WHERE property_id = ?",
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Property not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// CREATE PROPERTY - Add new property/subdivision
// ============================================================
exports.createProperty = async (req, res) => {
  const { property_name, location, total_lots, status } = req.body;

  if (!property_name || !location) {
    return res
      .status(400)
      .json({ error: "Property name and location are required" });
  }

  const query = `
    INSERT INTO properties
    (property_name, location, total_lots, status)
    VALUES (?, ?, ?, ?)
  `;

  try {
    const [result] = await db.query(query, [
      property_name,
      location,
      total_lots || 0,
      status || "active",
    ]);
    res
      .status(201)
      .json({
        message: "Property added successfully",
        property_id: result.insertId,
      });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// UPDATE PROPERTY - Edit property details
// ============================================================
exports.updateProperty = async (req, res) => {
  const { id } = req.params;
  const { property_name, location, total_lots, status } = req.body;

  const query = `
    UPDATE properties
    SET property_name = ?, location = ?, 
        total_lots = ?, status = ?
    WHERE property_id = ?
  `;

  try {
    const [result] = await db.query(query, [
      property_name,
      location,
      total_lots,
      status,
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Property not found" });
    }

    res.json({ message: "Property updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// UPDATE PROPERTY STATUS - Set property status (active/inactive)
// ============================================================
exports.updatePropertyStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !["active", "inactive"].includes(status)) {
    return res
      .status(400)
      .json({ error: "Status must be 'active' or 'inactive'" });
  }

  try {
    const [result] = await db.query(
      "UPDATE properties SET status = ? WHERE property_id = ?",
      [status, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Property not found" });
    }

    res.json({ message: "Property status updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// DELETE PROPERTY - Delete property
// ============================================================
exports.deleteProperty = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query(
      "DELETE FROM properties WHERE property_id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Property not found" });
    }

    res.json({ message: "Property deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
