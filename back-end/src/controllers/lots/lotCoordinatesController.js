// controllers/lots/lotCoordinatesController.js
const db = require("../../../config/database_connection");

// =======================
// UPDATE LOT COORDINATES
// =======================
exports.updateLotCoordinates = async (req, res) => {
  const { id } = req.params;
  const { coordinates } = req.body;

  try {
    // Validate coordinates
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
      return res.status(400).json({
        error: "Invalid coordinates. Must be a non-empty array",
      });
    }

    // Handle single coordinate [lat, lng] or polygon coordinates [[lat1, lng1], [lat2, lng2], ...]
    if (
      coordinates.length === 2 &&
      typeof coordinates[0] === "number" &&
      typeof coordinates[1] === "number"
    ) {
      // Single coordinate format [lat, lng]
      const [lat, lng] = coordinates;
      if (typeof lat !== "number" || typeof lng !== "number") {
        return res.status(400).json({
          error: "Invalid coordinates. Both latitude and longitude must be numbers",
        });
      }
    } else {
      // Polygon coordinates format [[lat1, lng1], [lat2, lng2], ...]
      for (let i = 0; i < coordinates.length; i++) {
        const coord = coordinates[i];
        if (!Array.isArray(coord) || coord.length !== 2) {
          return res.status(400).json({
            error: `Invalid coordinate pair at index ${i}. Each coordinate must be [latitude, longitude]`,
          });
        }
        const [lat, lng] = coord;
        if (typeof lat !== "number" || typeof lng !== "number") {
          return res.status(400).json({
            error: `Invalid coordinates at index ${i}. Both latitude and longitude must be numbers`,
          });
        }
      }
    }

    // Check if lot exists
    const [lotRows] = await db.query("SELECT * FROM lots WHERE lot_id = ?", [id]);
    if (lotRows.length === 0) {
      return res.status(404).json({ error: "Lot not found" });
    }

    // Update coordinates
    await db.query("UPDATE lots SET coordinates = ? WHERE lot_id = ?", [
      JSON.stringify(coordinates),
      id,
    ]);

    console.log(
      `📍 [Lot Coordinates Saved] Lot ID #${id} (${lotRows[0]?.lot_number || "Lot"}) | Vertices: ${coordinates.length}`
    );

    res.json({
      message: "Lot coordinates updated successfully",
      coordinates,
    });
  } catch (err) {
    console.error(`❌ [Update Lot Coordinates Error] Lot #${id}:`, err);
    res.status(500).json({ error: err.message });
  }
};

// =======================
// BULK SHIFT PROPERTY LOTS
// =======================
exports.bulkShiftPropertyLots = async (req, res) => {
  const { propertyId } = req.params;
  const { deltaLat, deltaLng } = req.body;

  if (typeof deltaLat !== "number" || typeof deltaLng !== "number") {
    return res.status(400).json({ error: "deltaLat and deltaLng must be numbers" });
  }

  try {
    // Get all lots for this property with coordinates
    const [lots] = await db.query(
      "SELECT lot_id, coordinates FROM lots WHERE property_id = ? AND coordinates IS NOT NULL",
      [propertyId]
    );

    if (lots.length === 0) {
      return res.json({ message: "No lots with coordinates to shift", updatedCount: 0 });
    }

    // Update each lot coordinates by adding delta offset
    for (const lot of lots) {
      let coords =
        typeof lot.coordinates === "string" ? JSON.parse(lot.coordinates) : lot.coordinates;
      if (!Array.isArray(coords)) continue;

      const shiftedCoords = coords.map(([lat, lng]) => [lat + deltaLat, lng + deltaLng]);

      await db.query("UPDATE lots SET coordinates = ? WHERE lot_id = ?", [
        JSON.stringify(shiftedCoords),
        lot.lot_id,
      ]);
    }

    // Also shift any road labels / map annotations stored in the property
    const [propRows] = await db.query(
      "SELECT annotations FROM properties WHERE property_id = ?",
      [propertyId]
    );
    if (propRows.length > 0 && propRows[0].annotations) {
      try {
        let annots =
          typeof propRows[0].annotations === "string"
            ? JSON.parse(propRows[0].annotations)
            : propRows[0].annotations;
        if (Array.isArray(annots) && annots.length > 0) {
          const shiftedAnnots = annots.map((a) => {
            if (typeof a.lat === "number" && typeof a.lng === "number") {
              return { ...a, lat: a.lat + deltaLat, lng: a.lng + deltaLng };
            }
            return a;
          });
          await db.query(
            "UPDATE properties SET annotations = ? WHERE property_id = ?",
            [JSON.stringify(shiftedAnnots), propertyId]
          );
          console.log(
            `🗺️ [Bulk Shift Annotations] Property #${propertyId} | Shifted ${shiftedAnnots.length} road labels`
          );
        }
      } catch (e) {
        console.error(`⚠️ [Bulk Shift Annotations Warning] Property #${propertyId}:`, e);
      }
    }

    console.log(
      `🗺️ [Bulk Shift Lots] Property #${propertyId} | Shifted ${lots.length} lot polygons (ΔLat: ${deltaLat}, ΔLng: ${deltaLng})`
    );

    res.json({
      message: `Successfully shifted coordinates for ${lots.length} lots and road labels`,
      updatedCount: lots.length,
    });
  } catch (err) {
    console.error(`❌ [Bulk Shift Lots Error] Property #${propertyId}:`, err);
    res.status(500).json({ error: err.message });
  }
};
