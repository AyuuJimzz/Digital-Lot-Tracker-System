// controllers/lotsController.js
const db = require("../../config/database_connection");

// Sub-controllers
const lotAnalytics = require("./lots/lotAnalyticsController");
const lotStatus = require("./lots/lotStatusController");
const lotCoordinates = require("./lots/lotCoordinatesController");
const lotReminders = require("./lots/lotRemindersController");

// =======================
// READ / QUERY OPERATIONS
// =======================
exports.getAllLots = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM lots ORDER BY property_id, lot_number");
    res.json(rows);
  } catch (err) {
    console.error("Error in getAllLots:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getLotsByProperty = async (req, res) => {
  const { propertyId } = req.params;

  try {
    const [rows] = await db.query("SELECT * FROM lots WHERE property_id = ? ORDER BY lot_number", [
      propertyId,
    ]);
    res.json(rows);
  } catch (err) {
    console.error("Error in getLotsByProperty:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getLotById = async (req, res) => {
  const { id } = req.params;

  try {
    const [lotRows] = await db.query("SELECT * FROM lots WHERE lot_id = ?", [id]);

    if (lotRows.length === 0) {
      return res.status(404).json({ error: "Lot not found" });
    }

    const lot = lotRows[0];

    // Get customer information if exists
    const [customerRows] = await db.query("SELECT * FROM customers WHERE lot_id = ?", [id]);

    // Add customer information to lot object if exists
    if (customerRows.length > 0) {
      lot.customer = customerRows[0];
    }

    // Get transaction information (payment method & agent) if exists
    const [transactionRows] = await db.query(
      `SELECT t.payment_type, t.employee_id, 
              COALESCE(t.agent_name, NULLIF(TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))), ''), 'Admin') AS agent_name
       FROM transactions t
       LEFT JOIN employees e ON t.employee_id = e.employee_id
       WHERE t.lot_id = ? 
       ORDER BY t.transaction_date DESC, t.transaction_id DESC LIMIT 1`,
      [id]
    );

    if (transactionRows.length > 0) {
      if (lot.status === "Sold") {
        lot.payment_method = transactionRows[0].payment_type;
      }
      lot.agent_name = transactionRows[0].agent_name;
      lot.employee_id = transactionRows[0].employee_id;
    }

    if (lot.coordinates && typeof lot.coordinates === "string") {
      try {
        lot.coordinates = JSON.parse(lot.coordinates);
      } catch (e) {
        console.error("Error parsing lot coordinates in getLotById:", e);
      }
    }

    res.json(lot);
  } catch (err) {
    console.error("Error in getLotById:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getMapData = async (req, res) => {
  try {
    const [propertyRows] = await db.query(
      `SELECT property_id, property_name, location, total_lots, status, annotations FROM properties ORDER BY property_id ASC`
    );

    const [rows] = await db.query(
      `SELECT l.lot_id, l.property_id, l.lot_number, l.area_sqm, l.status, l.coordinates,
              c.full_name AS customer_name, c.email AS customer_email, c.contact_number AS customer_contact, c.address AS customer_address
       FROM lots l
       LEFT JOIN (
         SELECT customer_id, lot_id, full_name, email, contact_number, address,
                ROW_NUMBER() OVER (PARTITION BY lot_id ORDER BY updated_at DESC, customer_id DESC) AS rn
         FROM customers
         WHERE lot_id IS NOT NULL
       ) c ON l.lot_id = c.lot_id AND c.rn = 1
       WHERE l.coordinates IS NOT NULL 
       ORDER BY l.property_id, l.lot_number`
    );

    // Format the data similar to the original lotData structure
    const mapData = {
      summary: {
        totalLots: rows.length,
        availableLots: rows.filter((lot) => lot.status === "Available").length,
        pendingLots: rows.filter((lot) => lot.status === "Pending").length,
        soldLots: rows.filter((lot) => lot.status === "Sold").length,
      },
      properties: propertyRows,
      lots: rows.map((lot) => {
        const hasCustomer = Boolean(lot.customer_name || lot.customer_email || lot.customer_contact);
        let parsedCoordinates = lot.coordinates;
        if (typeof lot.coordinates === "string") {
          try {
            parsedCoordinates = JSON.parse(lot.coordinates);
          } catch (e) {
            console.error("Error parsing coordinates for lot:", lot.lot_id, e);
          }
        }

        return {
          lot_id: lot.lot_id,
          property_id: lot.property_id,
          lot_number: lot.lot_number,
          area_sqm: lot.area_sqm,
          status: lot.status,
          customer: hasCustomer
            ? {
                full_name: lot.customer_name || "",
                email: lot.customer_email || "",
                contact_number: lot.customer_contact || "",
                address: lot.customer_address || "",
              }
            : null,
          coordinates: parsedCoordinates,
        };
      }),
    };

    res.json(mapData);
  } catch (error) {
    console.error("Error fetching map data:", error);
    res.status(500).json({ error: "Failed to fetch map data" });
  }
};

// =======================
// LOT MUTATION OPERATIONS
// =======================
exports.createLot = async (req, res) => {
  const { property_id, lot_number, area_sqm, status } = req.body;

  try {
    if (!property_id || !lot_number || !area_sqm) {
      return res.status(400).json({ error: "Property ID, Lot Number, and Area are required" });
    }

    const [result] = await db.query(
      `INSERT INTO lots (property_id, lot_number, area_sqm, status, coordinates) 
       VALUES (?, ?, ?, ?, NULL)`,
      [property_id, lot_number, area_sqm, status || "Available"]
    );

    console.log(
      `📐 [New Lot Created] ID #${result.insertId} | Lot ${lot_number} (Property #${property_id}) | Area: ${area_sqm} sqm | Status: ${status || "Available"}`
    );

    res.status(201).json({
      message: "Lot created successfully",
      lot_id: result.insertId,
      property_id,
      lot_number,
      area_sqm,
      status: status || "Available",
      coordinates: null,
    });
  } catch (err) {
    console.error("❌ [Create Lot Error]:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteLot = async (req, res) => {
  const { id } = req.params;

  try {
    // Check if lot exists
    const [lotRows] = await db.query("SELECT * FROM lots WHERE lot_id = ?", [id]);
    if (lotRows.length === 0) {
      return res.status(404).json({ error: "Lot not found" });
    }

    // Delete the lot (foreign key constraints on customers/transactions have ON DELETE CASCADE)
    await db.query("DELETE FROM lots WHERE lot_id = ?", [id]);

    console.log(`🗑️ [Lot Deleted] ID #${id} (${lotRows[0]?.lot_number || "Lot"})`);

    res.json({
      message: "Lot deleted successfully",
      lot_id: Number(id),
    });
  } catch (err) {
    console.error(`❌ [Delete Lot Error] Lot #${id}:`, err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateLotDetails = async (req, res) => {
  const { id } = req.params;
  const { lot_number, area_sqm } = req.body;

  try {
    if (!lot_number || !area_sqm) {
      return res.status(400).json({ error: "Lot Number and Area (SQM) are required" });
    }

    // Check if lot exists
    const [lotRows] = await db.query("SELECT * FROM lots WHERE lot_id = ?", [id]);
    if (lotRows.length === 0) {
      return res.status(404).json({ error: "Lot not found" });
    }

    // Update lot details
    await db.query("UPDATE lots SET lot_number = ?, area_sqm = ? WHERE lot_id = ?", [
      lot_number.trim(),
      parseFloat(area_sqm),
      id,
    ]);

    console.log(
      `📐 [Lot Details Updated] ID #${id} | Number: ${lot_number.trim()} | Area: ${area_sqm} sqm`
    );

    res.json({
      message: "Lot details updated successfully",
      lot_id: Number(id),
      lot_number: lot_number.trim(),
      area_sqm: parseFloat(area_sqm),
    });
  } catch (err) {
    console.error(`❌ [Update Lot Details Error] Lot #${id}:`, err);
    res.status(500).json({ error: err.message });
  }
};

// =======================
// DELEGATED SUB-CONTROLLER EXPORTS
// =======================
// Analytics & Statistics
exports.getDashboardStats = lotAnalytics.getDashboardStats;
exports.getPropertyLotStats = lotAnalytics.getPropertyLotStats;
exports.getMonthlySalesData = lotAnalytics.getMonthlySalesData;
exports.getTimeBasedPropertySales = lotAnalytics.getTimeBasedPropertySales;

// Status & Lifecycle Transitions
exports.updateLotStatus = lotStatus.updateLotStatus;

// GIS Coordinates & Bulk Operations
exports.updateLotCoordinates = lotCoordinates.updateLotCoordinates;
exports.bulkShiftPropertyLots = lotCoordinates.bulkShiftPropertyLots;

// Automated Reminder System
exports.sendPendingLotReminders = lotReminders.sendPendingLotReminders;
