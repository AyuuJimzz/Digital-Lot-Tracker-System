const db = require("../../config/database_connection");
const { isNonSaleableLot, parseNonSaleableFlag } = require("../utils/lotClassification");

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
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 5000, 1), 5000);
    const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
    const [rows] = await db.query(
      "SELECT lot_id, property_id, lot_number, area_sqm, status, is_non_saleable, pending_since, DATE_FORMAT(sold_on, '%Y-%m-%d') AS sold_on FROM lots ORDER BY property_id, lot_number LIMIT ? OFFSET ?",
      [limit, offset]
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
      "SELECT lot_id, property_id, lot_number, area_sqm, status, is_non_saleable, coordinates, pending_since, DATE_FORMAT(sold_on, '%Y-%m-%d') AS sold_on, last_reminder_sent FROM lots WHERE property_id = ? ORDER BY lot_number",
      [propertyId]
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
    const [lotRows] = await db.query(
      "SELECT lot_id, property_id, lot_number, area_sqm, status, is_non_saleable, coordinates, pending_since, DATE_FORMAT(sold_on, '%Y-%m-%d') AS sold_on, last_reminder_sent FROM lots WHERE lot_id = ?",
      [id]
    );

    if (lotRows.length === 0) {
      return res.status(404).json({ error: "Lot not found" });
    }

    const lot = lotRows[0];
    if (lot.status === "Available") {
      lot.pending_since = null;
      lot.sold_on = null;
    }

    // Get customer information if exists (strictly active Pending/Sold lots, never for Available lots)
    let customerRows = [];
    if (lot.status !== "Available") {
      const [rows] = await db.query(
        "SELECT customer_id, lot_id, full_name, contact_number, email, address, employee_id, customer_status, created_at, updated_at FROM customers WHERE lot_id = ? AND customer_status IN ('Pending', 'Sold') ORDER BY updated_at DESC, customer_id DESC LIMIT 1",
        [id]
      );
      customerRows = rows;
    }

    // Add customer information to lot object if exists
    if (customerRows.length > 0) {
      lot.customer = customerRows[0];
    } else {
      lot.customer = null;
    }

    if (lot.status === "Available") {
      lot.customer = null;
      lot.agent_name = null;
      lot.agent_status = null;
      lot.employee_id = null;
      lot.payment_method = null;
      lot.total_contract_price = null;
      lot.downpayment = null;
      lot.terms_months = null;
      lot.monthly_amortization = null;
    } else {
      // Get transaction information (payment method & agent) if exists
      const customerEmpId = lot.customer?.employee_id || null;
      const customerId = lot.customer?.customer_id || null;
      const customerFilterSql = customerId ? "AND (t.customer_id = ? OR t.customer_id IS NULL)" : "";
      const queryParams = [
        customerEmpId,
        customerEmpId,
        customerEmpId,
        customerEmpId,
        id,
      ];
      if (customerId) {
        queryParams.push(customerId);
      }

      const [transactionRows] = await db.query(
        `SELECT t.payment_type,
                t.total_contract_price,
                t.downpayment,
                t.terms_months,
                t.monthly_amortization,
                CASE
                  WHEN t.agent_name = 'Old Record' THEN NULL
                  WHEN t.agent_name IS NOT NULL AND t.employee_id IS NULL AND t.agent_name != 'Admin' THEN NULL
                  ELSE COALESCE(t.employee_id, ?)
                END AS employee_id,
                COALESCE(NULLIF(t.agent_name, 'Agent'), NULLIF(TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))), ''), t.agent_name, 'Admin') AS agent_name,
                CASE
                  WHEN t.agent_name = 'Old Record' THEN 'legacy'
                  WHEN t.agent_name IS NOT NULL AND t.employee_id IS NULL AND t.agent_name != 'Admin' THEN 'external'
                  WHEN (CASE WHEN t.agent_name = 'Old Record' THEN NULL WHEN t.agent_name IS NOT NULL AND t.employee_id IS NULL AND t.agent_name != 'Admin' THEN NULL ELSE COALESCE(t.employee_id, ?) END) IS NULL AND (t.agent_name IS NULL OR t.agent_name = 'Admin') THEN 'admin'
                  WHEN (CASE WHEN t.agent_name = 'Old Record' THEN NULL WHEN t.agent_name IS NOT NULL AND t.employee_id IS NULL AND t.agent_name != 'Admin' THEN NULL ELSE COALESCE(t.employee_id, ?) END) IS NULL AND t.agent_name IS NOT NULL THEN 'external'
                  WHEN e.status = 'active' THEN 'active'
                  ELSE 'inactive'
                END AS agent_status
         FROM transactions t
         LEFT JOIN employees e ON (
           CASE
             WHEN t.agent_name = 'Old Record' THEN NULL
             WHEN t.agent_name IS NOT NULL AND t.employee_id IS NULL AND t.agent_name != 'Admin' THEN NULL
             ELSE COALESCE(t.employee_id, ?)
           END
         ) = e.employee_id
         WHERE t.lot_id = ? ${customerFilterSql} AND t.payment_type NOT IN ('Reversal', 'Cancelled')
           AND NOT EXISTS (
             SELECT 1 FROM transactions rev
             WHERE rev.lot_id = t.lot_id
               AND (rev.payment_type IN ('Reversal', 'Cancelled') OR COALESCE(rev.notes, '') LIKE 'Reversal of Sale%')
               AND rev.transaction_id > t.transaction_id
           )
         ORDER BY t.transaction_date DESC, t.transaction_id DESC LIMIT 1`,
        queryParams
      );

      if (transactionRows.length > 0) {
        if (lot.status !== "Available") {
          lot.payment_method = transactionRows[0].payment_type;
        }
        lot.total_contract_price = transactionRows[0].total_contract_price != null ? Number(transactionRows[0].total_contract_price) : null;
        lot.downpayment = transactionRows[0].downpayment != null ? Number(transactionRows[0].downpayment) : null;
        lot.terms_months = transactionRows[0].terms_months != null ? Number(transactionRows[0].terms_months) : null;
        lot.monthly_amortization = transactionRows[0].monthly_amortization != null ? Number(transactionRows[0].monthly_amortization) : null;
        lot.agent_name = transactionRows[0].agent_name;
        lot.agent_status = transactionRows[0].agent_status;
        lot.employee_id = transactionRows[0].employee_id;
      } else {
        lot.total_contract_price = null;
        lot.downpayment = null;
        lot.terms_months = null;
        lot.monthly_amortization = null;
        if (lot.customer?.employee_id) {
          try {
            const [empRows] = await db.query(
              "SELECT first_name, last_name, status FROM employees WHERE employee_id = ?",
              [lot.customer.employee_id]
            );
            if (empRows.length > 0) {
              lot.agent_name = `${empRows[0].first_name || ""} ${empRows[0].last_name || ""}`.trim() || "Agent";
              lot.agent_status = empRows[0].status === "active" ? "active" : "inactive";
            } else {
              lot.agent_name = "Agent";
              lot.agent_status = "inactive";
            }
          } catch (_) {
            lot.agent_name = "Agent";
            lot.agent_status = "inactive";
          }
          lot.employee_id = lot.customer.employee_id;
        } else {
          lot.agent_name = "Admin";
          lot.agent_status = "admin";
          lot.employee_id = null;
        }
      }
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
      `SELECT l.lot_id, l.property_id, l.lot_number, l.area_sqm, l.status, l.is_non_saleable, l.coordinates,
              CASE WHEN l.status = 'Available' THEN NULL ELSE l.pending_since END AS pending_since,
              CASE WHEN l.status = 'Available' THEN NULL ELSE DATE_FORMAT(l.sold_on, '%Y-%m-%d') END AS sold_on,
              CASE WHEN l.status = 'Available' THEN NULL ELSE c.full_name END AS customer_name,
              CASE WHEN l.status = 'Available' THEN NULL ELSE c.email END AS customer_email,
              CASE WHEN l.status = 'Available' THEN NULL ELSE c.contact_number END AS customer_contact,
              CASE WHEN l.status = 'Available' THEN NULL ELSE c.address END AS customer_address,
              CASE WHEN l.status = 'Available' THEN NULL ELSE t.payment_type END AS payment_method,
              CASE WHEN l.status = 'Available' THEN NULL ELSE t.total_contract_price END AS total_contract_price,
              CASE WHEN l.status = 'Available' THEN NULL ELSE t.downpayment END AS downpayment,
              CASE WHEN l.status = 'Available' THEN NULL ELSE t.terms_months END AS terms_months,
              CASE WHEN l.status = 'Available' THEN NULL ELSE t.monthly_amortization END AS monthly_amortization,
              CASE
                WHEN l.status = 'Available' THEN NULL
                WHEN t.agent_name = 'Old Record' THEN NULL
                WHEN t.agent_name IS NOT NULL AND t.employee_id IS NULL AND t.agent_name != 'Admin' THEN NULL
                ELSE COALESCE(t.employee_id, c.employee_id)
              END AS employee_id,
              CASE
                WHEN l.status = 'Available' THEN NULL
                ELSE COALESCE(NULLIF(t.agent_name, 'Agent'), NULLIF(TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))), ''), t.agent_name, CASE WHEN COALESCE(t.employee_id, c.employee_id) IS NOT NULL THEN 'Agent' ELSE 'Admin' END)
              END AS agent_name,
              CASE
                WHEN l.status = 'Available' THEN NULL
                WHEN t.agent_name = 'Old Record' THEN 'legacy'
                WHEN t.agent_name IS NOT NULL AND t.employee_id IS NULL AND t.agent_name != 'Admin' THEN 'external'
                WHEN (CASE WHEN t.agent_name = 'Old Record' THEN NULL WHEN t.agent_name IS NOT NULL AND t.employee_id IS NULL AND t.agent_name != 'Admin' THEN NULL ELSE COALESCE(t.employee_id, c.employee_id) END) IS NULL AND (t.agent_name IS NULL OR t.agent_name = 'Admin') THEN 'admin'
                WHEN (CASE WHEN t.agent_name = 'Old Record' THEN NULL WHEN t.agent_name IS NOT NULL AND t.employee_id IS NULL AND t.agent_name != 'Admin' THEN NULL ELSE COALESCE(t.employee_id, c.employee_id) END) IS NULL AND t.agent_name IS NOT NULL THEN 'external'
                WHEN e.status = 'active' THEN 'active'
                ELSE 'inactive'
              END AS agent_status
       FROM lots l
       LEFT JOIN (
         SELECT customer_id, lot_id, full_name, email, contact_number, address, employee_id,
                ROW_NUMBER() OVER (PARTITION BY lot_id ORDER BY updated_at DESC, customer_id DESC) AS rn
         FROM customers
         WHERE lot_id IS NOT NULL AND customer_status IN ('Pending', 'Sold')
       ) c ON l.lot_id = c.lot_id AND c.rn = 1 AND l.status != 'Available'
       LEFT JOIN (
         SELECT lot_id, customer_id, employee_id, agent_name, payment_type,
                total_contract_price, downpayment, terms_months, monthly_amortization,
                ROW_NUMBER() OVER (PARTITION BY lot_id, customer_id ORDER BY transaction_date DESC, transaction_id DESC) AS rn
         FROM transactions
         WHERE lot_id IS NOT NULL AND customer_id IS NOT NULL AND payment_type NOT IN ('Reversal', 'Cancelled')
       ) t ON l.lot_id = t.lot_id AND c.customer_id = t.customer_id AND t.rn = 1
       LEFT JOIN employees e ON (
         CASE
           WHEN t.agent_name = 'Old Record' THEN NULL
           WHEN t.agent_name IS NOT NULL AND t.employee_id IS NULL AND t.agent_name != 'Admin' THEN NULL
           ELSE COALESCE(t.employee_id, c.employee_id)
         END
       ) = e.employee_id
       WHERE l.coordinates IS NOT NULL
       ORDER BY l.property_id, l.lot_number`
    );

    // Estate-wide lot summary (authoritative across all lots, independent of coordinate plotting)
    const [allLotRows] = await db.query(
      `SELECT lot_id, lot_number, status, is_non_saleable, (coordinates IS NOT NULL) AS has_coordinates FROM lots`
    );
    const nonSaleableLots = allLotRows.filter((lot) => isNonSaleableLot(lot)).length;
    const totalSaleableLots = allLotRows.length - nonSaleableLots;
    const availableLots = allLotRows.filter((lot) => lot.status === "Available" && !isNonSaleableLot(lot)).length;
    const pendingLots = allLotRows.filter((lot) => lot.status === "Pending" && !isNonSaleableLot(lot)).length;
    const soldLots = allLotRows.filter((lot) => lot.status === "Sold" && !isNonSaleableLot(lot)).length;
    const plottedLots = allLotRows.filter((lot) => lot.has_coordinates).length;

    const mapData = {
      summary: {
        totalLots: totalSaleableLots,
        totalParcels: allLotRows.length,
        availableLots,
        pendingLots,
        soldLots,
        nonSaleableLots,
        plottedLots,
      },
      properties: propertyRows,
      lots: rows.map((lot) => {
        const hasCustomer = Boolean(lot.customer_name || lot.customer_email || lot.customer_contact || lot.customer_address);
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
          pending_since: lot.pending_since,
          sold_on: lot.sold_on,
          is_non_saleable: isNonSaleableLot(lot) ? 1 : 0,
          employee_id: lot.employee_id,
          agent_name: lot.agent_name,
          agent_status: lot.agent_status,
          payment_method: lot.payment_method || null,
          total_contract_price: lot.total_contract_price != null ? Number(lot.total_contract_price) : null,
          downpayment: lot.downpayment != null ? Number(lot.downpayment) : null,
          terms_months: lot.terms_months != null ? Number(lot.terms_months) : null,
          monthly_amortization: lot.monthly_amortization != null ? Number(lot.monthly_amortization) : null,
          customer: hasCustomer
            ? {
                full_name: lot.customer_name || "",
                email: lot.customer_email || "",
                contact_number: lot.customer_contact || "",
                address: lot.customer_address || "",
                employee_id: lot.employee_id,
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

    let isNonSaleable;
    try {
      isNonSaleable = parseNonSaleableFlag(req.body.is_non_saleable, lot_number);
    } catch (parseErr) {
      return res.status(400).json({ error: parseErr.message });
    }

    const initialStatus = status || "Available";

    // Guard: Non-saleable lots can NEVER be created with Pending or Sold status
    if (isNonSaleable && initialStatus !== "Available") {
      return res.status(400).json({
        error: "Non-saleable lots (parks, amenities, facilities, and excluded areas) cannot be created with Pending or Sold status.",
      });
    }

    const [result] = await db.query(
      `INSERT INTO lots (property_id, lot_number, area_sqm, status, is_non_saleable, coordinates)
       VALUES (?, ?, ?, ?, ?, NULL)`,
      [property_id, lot_number, area_sqm, initialStatus, isNonSaleable]
    );

    console.log(
      `📐 [New Lot Created] ID #${result.insertId} | Lot ${lot_number} (Property #${property_id}) | Area: ${area_sqm} sqm | Status: ${initialStatus} | Non-Saleable: ${isNonSaleable}`
    );

    res.status(201).json({
      message: "Lot created successfully",
      lot_id: result.insertId,
      property_id,
      lot_number,
      area_sqm,
      status: initialStatus,
      is_non_saleable: isNonSaleable,
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
  const dbToUse = req?.db || db;
  let connection;

  try {
    if (!lot_number || !area_sqm) {
      return res.status(400).json({ error: "Lot Number and Area (SQM) are required" });
    }

    connection = await dbToUse.getConnection();
    await connection.beginTransaction();

    // Concurrency Lock: Read and validate lot status inside transaction with row lock
    const [lotRows] = await connection.query(
      "SELECT lot_id, property_id, lot_number, area_sqm, status, is_non_saleable FROM lots WHERE lot_id = ? FOR UPDATE",
      [id]
    );
    if (lotRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Lot not found" });
    }

    const existingLot = lotRows[0];
    let isNonSaleable;
    try {
      isNonSaleable = req.body.is_non_saleable !== undefined
        ? parseNonSaleableFlag(req.body.is_non_saleable)
        : (existingLot.is_non_saleable !== undefined && existingLot.is_non_saleable !== null
            ? (Number(existingLot.is_non_saleable) === 1 ? 1 : 0)
            : parseNonSaleableFlag(undefined, lot_number));
    } catch (parseErr) {
      await connection.rollback();
      return res.status(400).json({ error: parseErr.message });
    }

    // Guard under lock: Cannot re-classify an existing lot as non-saleable if it is currently reserved or sold
    if (isNonSaleable && existingLot.status !== "Available") {
      await connection.rollback();
      return res.status(400).json({
        error: `Cannot classify lot as non-saleable while its status is '${existingLot.status}'. Cancel reservation or change status to Available first.`,
      });
    }

    // Update lot details under active row lock
    await connection.query(
      "UPDATE lots SET lot_number = ?, area_sqm = ?, is_non_saleable = ? WHERE lot_id = ?",
      [lot_number.trim(), parseFloat(area_sqm), isNonSaleable, id]
    );

    await connection.commit();

    console.log(
      `📐 [Lot Details Updated] ID #${id} | Number: ${lot_number.trim()} | Area: ${area_sqm} sqm | Non-Saleable: ${isNonSaleable}`
    );

    res.json({
      message: "Lot details updated successfully",
      lot_id: Number(id),
      lot_number: lot_number.trim(),
      area_sqm: parseFloat(area_sqm),
      is_non_saleable: isNonSaleable,
    });
  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (rbErr) {
        console.error("Error rolling back lot details update:", rbErr);
      }
    }
    console.error(`❌ [Update Lot Details Error] Lot #${id}:`, err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) connection.release();
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
exports.getSubdivisionColors = lotAnalytics.getSubdivisionColors;
exports.saveSubdivisionColors = lotAnalytics.saveSubdivisionColors;
exports.resetSubdivisionColors = lotAnalytics.resetSubdivisionColors;
exports.getMonthlySalesSheet = lotAnalytics.getMonthlySalesSheet;

// Status & Lifecycle Transitions
exports.updateLotStatus = lotStatus.updateLotStatus;

// GIS Coordinates & Bulk Operations
exports.updateLotCoordinates = lotCoordinates.updateLotCoordinates;
exports.bulkShiftPropertyLots = lotCoordinates.bulkShiftPropertyLots;
exports.batchUpdateLotCoordinates = lotCoordinates.batchUpdateLotCoordinates;

// Automated Reminder System
exports.sendPendingLotReminders = lotReminders.sendPendingLotReminders;
