// controllers/lotsController.js
const db = require("../../config/database_connection");

exports.getAllLots = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM lots ORDER BY property_id, lot_number",
    );
    res.json(rows);
  } catch (err) {
    console.error("Error in getAllLots:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getLotsByProperty = async (req, res) => {
  const { propertyId } = req.params;

  try {
    const [rows] = await db.query(
      "SELECT * FROM lots WHERE property_id = ? ORDER BY lot_number",
      [propertyId],
    );
    res.json(rows);
  } catch (err) {
    console.error("Error in getLotsByProperty:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getLotById = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query("SELECT * FROM lots WHERE lot_id = ?", [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Lot not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error in getLotById:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getMapData = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT lot_id, property_id, lot_number, area_sqm, status, coordinates 
       FROM lots 
       WHERE coordinates IS NOT NULL 
       ORDER BY property_id, lot_number`,
    );

    // Format the data similar to the original lotData structure
    const mapData = {
      summary: {
        totalLots: rows.length,
        availableLots: rows.filter((lot) => lot.status === "Available").length,
        pendingLots: rows.filter((lot) => lot.status === "Pending").length,
        soldLots: rows.filter((lot) => lot.status === "Sold").length,
      },
      lots: rows.map((lot) => ({
        lot_id: lot.lot_id,
        property_id: lot.property_id,
        lot_number: lot.lot_number,
        area_sqm: lot.area_sqm,
        status: lot.status,
        coordinates:
          typeof lot.coordinates === "string"
            ? JSON.parse(lot.coordinates)
            : lot.coordinates,
      })),
    };

    res.json(mapData);
  } catch (err) {
    console.error("Error in getMapData:", err);
    res.status(500).json({ error: err.message });
  }
};
