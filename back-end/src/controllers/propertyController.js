// controllers/propertyController.js
const db = require("../../config/database_connection");

// ============================================================
// GET ALL PROPERTIES - View all properties with dynamic lot count
// ============================================================
exports.getAllProperties = async (req, res) => {
  try {
    const query = `
      SELECT 
        p.*,
        COALESCE(lot_counts.actual_lots, 0) AS total_lots
      FROM properties p
      LEFT JOIN (
        SELECT property_id, COUNT(*) AS actual_lots
        FROM lots
        GROUP BY property_id
      ) lot_counts ON p.property_id = lot_counts.property_id
      ORDER BY p.property_id ASC
    `;
    const [rows] = await db.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// GET SINGLE PROPERTY - View property details with dynamic lot count
// ============================================================
exports.getPropertyById = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT 
        p.*,
        COALESCE(lot_counts.actual_lots, 0) AS total_lots
      FROM properties p
      LEFT JOIN (
        SELECT property_id, COUNT(*) AS actual_lots
        FROM lots
        GROUP BY property_id
      ) lot_counts ON p.property_id = lot_counts.property_id
      WHERE p.property_id = ?
    `;
    const [rows] = await db.query(query, [id]);

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
    return res.status(400).json({ error: "Property name and location are required" });
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
    console.log(`🏢 [New Property Created] ID #${result.insertId} | "${property_name}" (${location}) | Lots: ${total_lots || 0}`);
    res.status(201).json({
      message: "Property added successfully",
      property_id: result.insertId,
    });
  } catch (err) {
    console.error("❌ [Create Property Error]:", err);
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
    const [result] = await db.query(query, [property_name, location, total_lots, status, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Property not found" });
    }

    console.log(`🏢 [Property Updated] ID #${id} | "${property_name}" | Status: ${status}`);
    res.json({ message: "Property updated successfully" });
  } catch (err) {
    console.error(`❌ [Update Property Error] ID #${id}:`, err);
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
    return res.status(400).json({ error: "Status must be 'active' or 'inactive'" });
  }

  try {
    const [result] = await db.query("UPDATE properties SET status = ? WHERE property_id = ?", [
      status,
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Property not found" });
    }

    console.log(`🏢 [Property Status Changed] ID #${id} → ${status.toUpperCase()}`);
    res.json({ message: "Property status updated successfully" });
  } catch (err) {
    console.error(`❌ [Update Property Status Error] ID #${id}:`, err);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// DELETE PROPERTY - Delete property
// ============================================================
exports.deleteProperty = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query("DELETE FROM properties WHERE property_id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Property not found" });
    }

    console.log(`🗑️ [Property Deleted] ID #${id}`);
    res.json({ message: "Property deleted successfully" });
  } catch (err) {
    console.error(`❌ [Delete Property Error] ID #${id}:`, err);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// UPDATE PROPERTY ANNOTATIONS - Save road labels & map texts
// ============================================================
exports.updatePropertyAnnotations = async (req, res) => {
  const { id } = req.params;
  const { annotations } = req.body;

  try {
    const jsonVal = typeof annotations === "string" ? annotations : JSON.stringify(annotations || []);
    const [result] = await db.query(
      "UPDATE properties SET annotations = ? WHERE property_id = ?",
      [jsonVal, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Property not found" });
    }

    console.log(`🗺️ [Property Annotations Saved] ID #${id} (${Array.isArray(annotations) ? annotations.length : 0} labels)`);
    res.json({ message: "Property map annotations saved successfully" });
  } catch (err) {
    console.error(`❌ [Save Annotations Error] ID #${id}:`, err);
    res.status(500).json({ error: err.message });
  }
};

