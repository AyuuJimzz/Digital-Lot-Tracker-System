// controllers/lots/lotAnalyticsController.js
const db = require("../../../config/database_connection");
const { isNonSaleableLot, NON_SALEABLE_SQL_CONDITION } = require("../../utils/lotClassification");

// =======================
// DASHBOARD STATISTICS
// =======================
exports.getDashboardStats = async (req, res) => {
  try {
    const dbToUse = req.db || db;
    const requestedPropertyId =
      req.query?.property_id && req.query.property_id !== "all"
        ? Number(req.query.property_id)
        : null;

    // Get all lots with property_id, lot_number, status, is_non_saleable
    const [allLots] = await dbToUse.query(
      `SELECT lot_id, property_id, lot_number, status, is_non_saleable FROM lots`
    );

    // Get active properties metadata
    let activeProperties = [];
    try {
      const [props] = await dbToUse.query(
        `SELECT property_id, property_name, location, total_lots FROM properties WHERE status = 'active' ORDER BY property_id ASC`
      );
      activeProperties = props || [];
    } catch (propErr) {
      console.warn("Could not load active properties in dashboard stats:", propErr.message);
    }

    // Build per-subdivision summary
    const propertySummaryMap = {};
    activeProperties.forEach((p) => {
      propertySummaryMap[p.property_id] = {
        property_id: p.property_id,
        property_name: p.property_name,
        location: p.location,
        totalParcels: 0,
        totalLots: 0, // saleable
        availableLots: 0,
        pendingLots: 0,
        soldLots: 0,
        nonSaleableLots: 0,
      };
    });

    allLots.forEach((lot) => {
      const p = propertySummaryMap[lot.property_id];
      if (!p) return;
      p.totalParcels += 1;
      if (isNonSaleableLot(lot)) {
        p.nonSaleableLots += 1;
      } else {
        p.totalLots += 1;
        if (lot.status === "Available") p.availableLots += 1;
        if (lot.status === "Pending") p.pendingLots += 1;
        if (lot.status === "Sold") p.soldLots += 1;
      }
    });

    const subdivisions = Object.values(propertySummaryMap);

    // Target lots: filter if specific property requested
    const targetLots = requestedPropertyId
      ? allLots.filter((lot) => Number(lot.property_id) === requestedPropertyId)
      : allLots;

    const totalParcels = targetLots.length;
    const nonSaleableLots = targetLots.filter((lot) => isNonSaleableLot(lot)).length;
    const totalLots = totalParcels - nonSaleableLots; // Saleable inventory
    const availableLots = targetLots.filter((lot) => lot.status === "Available" && !isNonSaleableLot(lot)).length;
    const pendingLots = targetLots.filter((lot) => lot.status === "Pending" && !isNonSaleableLot(lot)).length;
    const soldLots = targetLots.filter((lot) => lot.status === "Sold" && !isNonSaleableLot(lot)).length;

    // Customer query with optional property_id filter
    const customerQueryParams = requestedPropertyId ? [requestedPropertyId] : [];
    const customerPropertyClause = requestedPropertyId ? `AND l.property_id = ?` : ``;

    const [customers] = await dbToUse.query(
      `
      SELECT COUNT(DISTINCT
        CASE
          WHEN c.full_name IS NOT NULL
            AND TRIM(c.full_name) != ''
            AND TRIM(LOWER(c.full_name)) != 'to be updated'
            THEN TRIM(LOWER(c.full_name))
          WHEN c.email IS NOT NULL
            AND TRIM(c.email) != ''
            AND TRIM(LOWER(c.email)) != 'to be updated'
            THEN TRIM(LOWER(c.email))
          WHEN c.contact_number IS NOT NULL
            AND TRIM(c.contact_number) != ''
            AND TRIM(LOWER(c.contact_number)) != 'to be updated'
            THEN TRIM(c.contact_number)
          ELSE NULL
        END
      ) as count
      FROM (
        SELECT customer_id, lot_id, full_name, email, contact_number, customer_status,
               ROW_NUMBER() OVER (PARTITION BY lot_id ORDER BY updated_at DESC, customer_id DESC) AS rn
        FROM customers
        WHERE lot_id IS NOT NULL
          AND (customer_status IN ('Pending', 'Sold') OR customer_status IS NULL)
      ) c
      JOIN lots l ON c.lot_id = l.lot_id
      WHERE c.rn = 1
        AND l.status IN ('Pending', 'Sold')
        ${customerPropertyClause}
    `,
      customerQueryParams
    );
    const totalClients = customers && customers[0] && customers[0].count ? Number(customers[0].count) : 0;

    const selectedProperty = requestedPropertyId
      ? activeProperties.find((p) => p.property_id === requestedPropertyId) || null
      : null;

    const stats = {
      propertyId: requestedPropertyId || "all",
      propertyName: selectedProperty ? selectedProperty.property_name : "All Projects (Whole Estate)",
      placeLocation: selectedProperty ? (selectedProperty.location || "Iloilo") : "Iloilo City",
      totalLots,
      availableLots,
      pendingLots,
      soldLots,
      totalParcels,
      nonSaleableLots,
      totalClients,
      subdivisions,
    };
    res.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
};

// =======================
// PROPERTY LOT STATISTICS
// =======================
exports.getPropertyLotStats = async (req, res) => {
  try {
    // Get all properties with their lot statistics, excluding non-saleable areas from available_lots
    const query = `
      SELECT 
        p.property_id,
        p.property_name,
        p.total_lots,
        COUNT(l.lot_id) as actual_lots,
        SUM(CASE WHEN l.status = 'Sold' AND NOT ${NON_SALEABLE_SQL_CONDITION} THEN 1 ELSE 0 END) as sold_lots,
        SUM(CASE WHEN l.status = 'Available' AND NOT ${NON_SALEABLE_SQL_CONDITION} THEN 1 ELSE 0 END) as available_lots,
        SUM(CASE WHEN l.status = 'Pending' AND NOT ${NON_SALEABLE_SQL_CONDITION} THEN 1 ELSE 0 END) as pending_lots,
        SUM(CASE WHEN ${NON_SALEABLE_SQL_CONDITION} THEN 1 ELSE 0 END) as non_saleable_lots
      FROM properties p
      LEFT JOIN lots l ON p.property_id = l.property_id
      WHERE p.status = 'active'
      GROUP BY p.property_id, p.property_name, p.total_lots
      ORDER BY p.property_id ASC
    `;

    const dbToUse = req.db || db;
    const [rows] = await dbToUse.query(query);

    // Transform data for frontend
    const colors = [
      "bg-orange-500",
      "bg-green-500",
      "bg-red-500",
      "bg-blue-500",
      "bg-purple-500",
      "bg-yellow-500",
    ];

    const propertyStats = rows.map((property, index) => {
      const totalCadastral = property.actual_lots || property.total_lots;
      const nonSaleable = Number(property.non_saleable_lots || 0);
      const saleableTotal = Math.max(totalCadastral - nonSaleable, 0);
      const sold = Number(property.sold_lots || 0);

      return {
        property_id: property.property_id,
        name: property.property_name,
        sold: sold,
        total: saleableTotal > 0 ? saleableTotal : totalCadastral,
        total_parcels: totalCadastral,
        non_saleable: nonSaleable,
        color: colors[index % colors.length],
      };
    });

    res.json(propertyStats);
  } catch (error) {
    console.error("Error fetching property lot stats:", error);
    res.status(500).json({ error: "Failed to fetch property lot statistics" });
  }
};

let dateVerifiedColumnCached = null;

async function checkDateVerifiedColumn(database) {
  if (dateVerifiedColumnCached === true && database === db) {
    return true;
  }
  try {
    const [cols] = await database.query(
      "SHOW COLUMNS FROM transactions WHERE Field IN ('is_date_verified', 'date_provenance')"
    );
    const exists = cols.length === 2;
    if (exists && database === db) dateVerifiedColumnCached = true;
    return exists;
  } catch (_) {
    return false;
  }
}

function resetDateVerifiedColumnCache() {
  dateVerifiedColumnCached = null;
}

// =======================
// MONTHLY SALES DATA
// =======================
exports.getMonthlySalesData = async (req, res) => {
  try {
    const dbToUse = req.db || db;
    const hasDateVerified = await checkDateVerifiedColumn(dbToUse);

    const verificationCondition = hasDateVerified ? "t.is_date_verified = 1" : "0=1";

    const currentYear = new Date().getFullYear();
    const queryYear = req.query?.year;
    const targetYear = queryYear && /^\d{4}$/.test(String(queryYear))
      ? parseInt(queryYear, 10)
      : currentYear;

    // Get monthly sales data for the selected target year
    /**
     * Reporting Rule for Sales Analytics:
     * 1. Count physical lots with current status = 'Sold'.
     * 2. Exclude reversal events and cancelled transactions.
     * 3. Safely include verified active sales and legacy backfilled records (customers with No Downpayment or NULL customer_id backfills).
     * 4. Exclude historical sales that were subsequent to a reversal (rev.transaction_id > t.transaction_id).
     * 5. Never allow unverified backfills into dated charts via (sold_on OR is_date_verified).
     */
    // 1. Dated Verified Sales query (for targetYear) with subdivision grouping
    const verifiedQuery = `
      SELECT 
        MONTH(COALESCE(l.sold_on, t.transaction_date)) as month,
        p.property_id,
        p.property_name,
        COUNT(DISTINCT l.lot_id) as lotsSold
      FROM transactions t
      INNER JOIN lots l ON t.lot_id = l.lot_id
      INNER JOIN properties p ON l.property_id = p.property_id
      LEFT JOIN customers c ON t.customer_id = c.customer_id
      WHERE YEAR(COALESCE(l.sold_on, t.transaction_date)) = ?
        AND l.status = 'Sold'
        AND NOT ${NON_SALEABLE_SQL_CONDITION}
        AND (c.customer_status = 'Sold' OR c.customer_status IS NULL)
        AND t.payment_type NOT IN ('Reversal', 'Cancelled')
        AND ${verificationCondition}
        AND NOT EXISTS (
          SELECT 1 FROM transactions rev
          WHERE rev.lot_id = l.lot_id
            AND (rev.payment_type IN ('Reversal', 'Cancelled') OR COALESCE(rev.notes, '') LIKE 'Reversal of Sale%')
            AND rev.transaction_id > t.transaction_id
        )
      GROUP BY MONTH(COALESCE(l.sold_on, t.transaction_date)), p.property_id, p.property_name
      ORDER BY MONTH(COALESCE(l.sold_on, t.transaction_date)), p.property_name
    `;
    const [rows] = await dbToUse.query(verifiedQuery, [targetYear]);

    // Discover all unique active subdivisions to standardize data keys
    const [propertyListRows] = await dbToUse.query(`
      SELECT property_id, property_name
      FROM properties
      WHERE status = 'active'
      ORDER BY property_id ASC
    `);
    const propertyList = propertyListRows.map((p) => ({
      id: p.property_id,
      name: p.property_name,
      shortName: p.property_name.replace(/\s+Oton\s+Cadastre/i, "").trim(),
      key: `subdiv_${p.property_id}`,
    }));

    // 2. Prior Years Verified Sales query
    const priorYearsQuery = `
      SELECT COUNT(DISTINCT l.lot_id) as count
      FROM transactions t
      INNER JOIN lots l ON t.lot_id = l.lot_id
      LEFT JOIN customers c ON t.customer_id = c.customer_id
      WHERE YEAR(COALESCE(l.sold_on, t.transaction_date)) < ?
        AND l.status = 'Sold'
        AND NOT ${NON_SALEABLE_SQL_CONDITION}
        AND (c.customer_status = 'Sold' OR c.customer_status IS NULL)
        AND t.payment_type NOT IN ('Reversal', 'Cancelled')
        AND ${verificationCondition}
        AND NOT EXISTS (
          SELECT 1 FROM transactions rev
          WHERE rev.lot_id = l.lot_id
            AND (rev.payment_type IN ('Reversal', 'Cancelled') OR COALESCE(rev.notes, '') LIKE 'Reversal of Sale%')
            AND rev.transaction_id > t.transaction_id
        )
    `;
    const [priorRows] = await dbToUse.query(priorYearsQuery, [currentYear]);
    const priorYearsVerifiedSoldLots = Number(priorRows[0]?.count || 0);

    // 3. Undated / Unverified Legacy Sold lots query
    // Includes any Sold lot in inventory that lacks an active, verified dated transaction
    const undatedQuery = `
      SELECT COUNT(DISTINCT l.lot_id) as count
      FROM lots l
      WHERE l.status = 'Sold'
        AND NOT ${NON_SALEABLE_SQL_CONDITION}
        AND NOT EXISTS (
          SELECT 1 FROM transactions t
          LEFT JOIN customers c ON t.customer_id = c.customer_id
          WHERE t.lot_id = l.lot_id
            AND (c.customer_status = 'Sold' OR c.customer_status IS NULL)
            AND t.payment_type NOT IN ('Reversal', 'Cancelled')
            AND ${verificationCondition}
            AND NOT EXISTS (
              SELECT 1 FROM transactions rev
              WHERE rev.lot_id = l.lot_id
                AND (rev.payment_type IN ('Reversal', 'Cancelled') OR COALESCE(rev.notes, '') LIKE 'Reversal of Sale%')
                AND rev.transaction_id > t.transaction_id
            )
        )
    `;
    const [undatedRows] = await dbToUse.query(undatedQuery);
    const undatedSoldLots = Number(undatedRows[0]?.count || 0);

    // 4. All-time saleable sold lots in inventory
    const [allTimeRows] = await dbToUse.query(`
      SELECT COUNT(*) as count
      FROM lots l
      WHERE l.status = 'Sold' AND NOT ${NON_SALEABLE_SQL_CONDITION}
    `);
    const allTimeSoldLots = Number(allTimeRows[0]?.count || 0);

    // 5. Discover all available years from recorded verified transactions
    const [yearRows] = await dbToUse.query(`
      SELECT DISTINCT YEAR(COALESCE(l.sold_on, t.transaction_date)) as year
      FROM transactions t
      INNER JOIN lots l ON t.lot_id = l.lot_id
      LEFT JOIN customers c ON t.customer_id = c.customer_id
      WHERE l.status = 'Sold'
        AND NOT ${NON_SALEABLE_SQL_CONDITION}
        AND (c.customer_status = 'Sold' OR c.customer_status IS NULL)
        AND t.payment_type NOT IN ('Reversal', 'Cancelled')
        AND ${verificationCondition}
        AND COALESCE(l.sold_on, t.transaction_date) IS NOT NULL
      ORDER BY year DESC
    `);
    const distinctYears = yearRows.map((r) => Number(r.year)).filter((y) => Boolean(y) && !isNaN(y));
    if (!distinctYears.includes(currentYear)) {
      distinctYears.push(currentYear);
    }
    distinctYears.sort((a, b) => b - a);

    // Create array for all 12 months with both aggregate lotsSold and subdivision breakdown
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const monthlyData = monthNames.map((month, index) => {
      const monthNum = index + 1;
      const matchingRows = rows.filter((r) => r.month === monthNum);
      const totalMonthSold = matchingRows.reduce((sum, r) => sum + Number(r.lotsSold || 0), 0);

      const entry = {
        month: month,
        lotsSold: totalMonthSold,
      };

      propertyList.forEach((prop) => {
        const found = matchingRows.find((r) => r.property_id === prop.id);
        entry[prop.key] = found ? Number(found.lotsSold || 0) : 0;
        entry[prop.shortName] = entry[prop.key];
      });

      return entry;
    });

    const totalYearSold = monthlyData.reduce((sum, item) => sum + item.lotsSold, 0);

    res.json({
      year: targetYear,
      availableYears: distinctYears,
      monthlyData,
      subdivisions: propertyList,
      totalYearSold,
      ytdVerifiedSoldLots: totalYearSold,
      verifiedSoldLots: totalYearSold, // backward-compatibility alias
      priorYearsVerifiedSoldLots,
      undatedSoldLots,
      allTimeSoldLots,
      totalSoldLots: allTimeSoldLots, // true all-time sold lots in inventory
    });
  } catch (error) {
    console.error("Error fetching monthly sales data:", error);
    res.status(500).json({ error: "Failed to fetch monthly sales data" });
  }
};

// =======================
// TIME-BASED PROPERTY SALES
// =======================
exports.getTimeBasedPropertySales = async (req, res) => {
  try {
    const dbToUse = req.db || db;
    const { period, date } = req.query || {};

    let dateFilter = "";
    const queryParams = [];
    const hasValidDate = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date);
    const isAllTime = !hasValidDate && ["all", "all time"].includes(String(period || "").toLowerCase().trim());

    if (hasValidDate) {
      dateFilter = "DATE(COALESCE(l.sold_on, t.transaction_date)) = ?";
      queryParams.push(date);
    } else {
      const p = (period || "month").toLowerCase().trim();
      switch (p) {
        case "today":
          dateFilter = "DATE(COALESCE(l.sold_on, t.transaction_date)) = CURDATE()";
          break;
        case "week":
        case "this week":
          dateFilter = "YEARWEEK(COALESCE(l.sold_on, t.transaction_date), 1) = YEARWEEK(CURDATE(), 1)";
          break;
        case "month":
        case "this month":
          dateFilter =
            "MONTH(COALESCE(l.sold_on, t.transaction_date)) = MONTH(CURDATE()) AND YEAR(COALESCE(l.sold_on, t.transaction_date)) = YEAR(CURDATE())";
          break;
        case "year":
        case "this year":
          dateFilter = "YEAR(COALESCE(l.sold_on, t.transaction_date)) = YEAR(CURDATE())";
          break;
        case "last year":
          dateFilter = "YEAR(COALESCE(l.sold_on, t.transaction_date)) = YEAR(CURDATE()) - 1";
          break;
        case "all":
        case "all time":
          dateFilter = "1=1";
          break;
        default:
          if (/^\d{4}$/.test(p)) {
            dateFilter = "YEAR(COALESCE(l.sold_on, t.transaction_date)) = ?";
            queryParams.push(parseInt(p, 10));
          } else if (/^\d{4}-\d{2}$/.test(p)) {
            dateFilter = "DATE_FORMAT(COALESCE(l.sold_on, t.transaction_date), '%Y-%m') = ?";
            queryParams.push(p);
          } else if (/^\d{4}-\d{2}-\d{2}$/.test(p)) {
            dateFilter = "DATE(COALESCE(l.sold_on, t.transaction_date)) = ?";
            queryParams.push(p);
          } else {
            dateFilter =
              "MONTH(COALESCE(l.sold_on, t.transaction_date)) = MONTH(CURDATE()) AND YEAR(COALESCE(l.sold_on, t.transaction_date)) = YEAR(CURDATE())";
          }
      }
    }

    const hasDateVerified = await checkDateVerifiedColumn(dbToUse);
    const verificationCondition = hasDateVerified ? "t.is_date_verified = 1" : "0=1";

    const verificationFilter = isAllTime
      ? "1=1"
      : verificationCondition;

    const query = `
      SELECT 
        p.property_id,
        p.property_name,
        p.total_lots,
        COUNT(l.lot_id) as actual_lots,
        SUM(CASE WHEN l.status = 'Sold' AND NOT ${NON_SALEABLE_SQL_CONDITION} AND EXISTS (
          SELECT 1 FROM transactions t
          LEFT JOIN customers c ON t.customer_id = c.customer_id
          WHERE t.lot_id = l.lot_id
            AND (c.customer_status = 'Sold' OR c.customer_status IS NULL)
            AND t.payment_type NOT IN ('Reversal', 'Cancelled')
            AND ${verificationFilter}
            AND NOT EXISTS (
              SELECT 1 FROM transactions rev
              WHERE rev.lot_id = l.lot_id
                AND (rev.payment_type IN ('Reversal', 'Cancelled') OR COALESCE(rev.notes, '') LIKE 'Reversal of Sale%')
                AND rev.transaction_id > t.transaction_id
            )
            AND ${dateFilter}
        ) THEN 1 ELSE 0 END) as sold_lots,
        SUM(CASE WHEN ${NON_SALEABLE_SQL_CONDITION} THEN 1 ELSE 0 END) as non_saleable_lots
      FROM properties p
      LEFT JOIN lots l ON p.property_id = l.property_id
      WHERE p.status = 'active'
      GROUP BY p.property_id, p.property_name, p.total_lots
      ORDER BY p.property_id ASC
    `;

    const [rows] = await dbToUse.query(query, queryParams);

    // Transform data for frontend
    const colors = [
      "bg-orange-500",
      "bg-green-500",
      "bg-red-500",
      "bg-blue-500",
      "bg-purple-500",
      "bg-yellow-500",
    ];

    const propertyStats = rows.map((property, index) => {
      const totalCadastral = property.actual_lots || property.total_lots;
      const nonSaleable = Number(property.non_saleable_lots || 0);
      const saleableTotal = Math.max(totalCadastral - nonSaleable, 0);
      const sold = Number(property.sold_lots || 0);

      return {
        property_id: property.property_id,
        name: property.property_name,
        sold: sold,
        total: saleableTotal > 0 ? saleableTotal : totalCadastral,
        total_parcels: totalCadastral,
        non_saleable: nonSaleable,
        color: colors[index % colors.length],
      };
    });

    res.json(propertyStats);
  } catch (error) {
    console.error("Error fetching time-based property sales:", error);
    res.status(500).json({ error: "Failed to fetch time-based property sales" });
  }
};

// =======================
// SUBDIVISION COLOR PALETTE PERSISTENCE (system_state)
// =======================
exports.getSubdivisionColors = async (req, res) => {
  try {
    const dbToUse = req.db || db;
    const [rows] = await dbToUse.query(
      "SELECT state_value FROM system_state WHERE state_key = 'subdivision_chart_colors'"
    );
    if (!rows.length || !rows[0].state_value) {
      return res.json({ colors: {} });
    }
    let colors = {};
    try {
      colors = JSON.parse(rows[0].state_value);
    } catch (_) {
      colors = {};
    }
    return res.json({ colors: colors && typeof colors === "object" && !Array.isArray(colors) ? colors : {} });
  } catch (error) {
    console.error("Error fetching subdivision colors:", error);
    return res.status(500).json({ error: "Failed to fetch subdivision colors" });
  }
};

exports.saveSubdivisionColors = async (req, res) => {
  try {
    const dbToUse = req.db || db;
    const incoming = req.body?.colors || req.body;
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
      return res.status(400).json({ error: "Invalid colors payload" });
    }

    const sanitized = {};
    for (const [key, val] of Object.entries(incoming)) {
      if (typeof val === "string") {
        const trimmed = val.trim();
        const match = trimmed.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (match) {
          const digits = match[1].length === 3
            ? match[1].split("").map((d) => `${d}${d}`).join("")
            : match[1];
          sanitized[String(key)] = `#${digits.toLowerCase()}`;
        }
      }
    }

    await dbToUse.query(
      `INSERT INTO system_state (state_key, state_value, updated_at)
       VALUES ('subdivision_chart_colors', ?, NOW())
       ON DUPLICATE KEY UPDATE state_value = VALUES(state_value), updated_at = NOW()`,
      [JSON.stringify(sanitized)]
    );

    return res.json({ success: true, colors: sanitized });
  } catch (error) {
    console.error("Error saving subdivision colors:", error);
    return res.status(500).json({ error: "Failed to save subdivision colors" });
  }
};

exports.resetSubdivisionColors = async (req, res) => {
  try {
    const dbToUse = req.db || db;
    await dbToUse.query("DELETE FROM system_state WHERE state_key = 'subdivision_chart_colors'");
    return res.json({ success: true, reset: true });
  } catch (error) {
    console.error("Error resetting subdivision colors:", error);
    return res.status(500).json({ error: "Failed to reset subdivision colors" });
  }
};

// =======================
// MONTHLY SALES FINANCIAL ACCOUNTING REPORT
// =======================
function parseBlockAndLot(lotNumber) {
  if (!lotNumber || typeof lotNumber !== "string") {
    return { block: "-", lot: "-" };
  }
  const str = lotNumber.trim();
  const blkMatch = str.match(/(?:blk|block|b)\.?\s*([0-9a-zA-Z-]+)\s*(?:lot|l)\.?\s*([0-9a-zA-Z-]+)/i);
  if (blkMatch) {
    return { block: blkMatch[1], lot: blkMatch[2] };
  }
  const lotOnlyMatch = str.match(/(?:lot|l)\.?\s*([0-9a-zA-Z-]+)/i);
  if (lotOnlyMatch) {
    return { block: "-", lot: lotOnlyMatch[1] };
  }
  const blkOnlyMatch = str.match(/(?:blk|block|b)\.?\s*([0-9a-zA-Z-]+)/i);
  if (blkOnlyMatch) {
    return { block: blkOnlyMatch[1], lot: "-" };
  }
  return { block: "-", lot: str };
}

function computeCollectionAmount(tx) {
  const tcp = Number(tx.total_contract_price) || 0;
  const dp = Number(tx.downpayment) || 0;
  const amort = Number(tx.monthly_amortization) || 0;
  const pType = String(tx.payment_type || "").toLowerCase();

  if (pType.includes("dp") && pType.includes("monthly")) {
    return (dp > 0 && amort > 0) ? (dp + amort) : (dp || amort || tcp || 0);
  }
  if (pType.includes("downpayment") || pType.includes("dp")) {
    return dp > 0 ? dp : (amort || tcp || 0);
  }
  if (pType.includes("monthly") || pType.includes("installment")) {
    return amort > 0 ? amort : (dp || tcp || 0);
  }
  if (pType.includes("reservation")) {
    return dp > 0 ? dp : (amort || 10000);
  }
  if (pType.includes("cash")) {
    return tcp > 0 ? tcp : (dp || amort || 0);
  }
  return dp || amort || tcp || 0;
}

exports.getMonthlySalesSheet = async (req, res) => {
  try {
    const dbToUse = req.db || db;
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
    const propertyId = req.query.property_id ? parseInt(req.query.property_id, 10) : null;
    const includeOldRecords = req.query.include_old_records === "true";

    let propCondition = "";
    const params = [year, month];
    if (propertyId) {
      propCondition = " AND p.property_id = ? ";
      params.push(propertyId);
    }

    const legacyFilter = includeOldRecords
      ? ""
      : " AND t.agent_name != 'Old Record' AND (t.notes IS NULL OR t.notes NOT LIKE '%Legacy sold record%') ";

    const query = `
      SELECT
        t.transaction_id,
        COALESCE(t.transaction_date, l.sold_on) AS purchase_date,
        t.payment_type,
        t.total_contract_price,
        t.downpayment,
        t.monthly_amortization,
        t.terms_months,
        t.notes,
        COALESCE(t.agent_name, NULLIF(TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))), ''), 'Admin') AS agent_name,
        l.lot_id,
        l.lot_number,
        l.status AS lot_status,
        p.property_id,
        p.property_name,
        c.customer_id,
        COALESCE(c.full_name, 'To be updated') AS customer_name
      FROM transactions t
      JOIN lots l ON t.lot_id = l.lot_id
      JOIN properties p ON l.property_id = p.property_id
      LEFT JOIN customers c ON t.customer_id = c.customer_id
      LEFT JOIN employees e ON t.employee_id = e.employee_id
      WHERE YEAR(COALESCE(t.transaction_date, l.sold_on)) = ?
        AND MONTH(COALESCE(t.transaction_date, l.sold_on)) = ?
        AND t.payment_type NOT IN ('Reversal', 'Cancelled')
        AND l.status = 'Sold'
        AND NOT EXISTS (
          SELECT 1 FROM transactions rev
          WHERE rev.lot_id = l.lot_id
            AND (rev.payment_type IN ('Reversal', 'Cancelled') OR COALESCE(rev.notes, '') LIKE 'Reversal of Sale%')
            AND rev.transaction_id > t.transaction_id
        )
        ${legacyFilter}
        ${propCondition}
      ORDER BY p.property_id ASC, purchase_date ASC, t.transaction_id ASC
    `;

    const [rows] = await dbToUse.query(query, params);

    // Group rows by project / subdivision
    const projectsMap = new Map();

    rows.forEach((row) => {
      const propId = row.property_id;
      if (!projectsMap.has(propId)) {
        projectsMap.set(propId, {
          property_id: propId,
          property_name: row.property_name,
          records: [],
          subtotal: {
            lots_sold: 0,
            total_amount: 0,
            total_tcp: 0,
          },
        });
      }

      const proj = projectsMap.get(propId);
      const { block, lot } = parseBlockAndLot(row.lot_number);
      const amount = computeCollectionAmount(row);
      const tcp = Number(row.total_contract_price) || 0;

      let dateFormatted = "";
      if (row.purchase_date) {
        try {
          const d = new Date(row.purchase_date);
          dateFormatted = d.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          });
        } catch (_) {
          dateFormatted = String(row.purchase_date);
        }
      }

      proj.records.push({
        transaction_id: row.transaction_id,
        item_number: proj.records.length + 1,
        buyer: row.customer_name,
        block: block,
        lot: lot,
        lot_number: row.lot_number,
        date_of_purchase: dateFormatted,
        raw_date: row.purchase_date,
        mode_of_payment: String(row.payment_type || "").trim().toLowerCase() === "cash" ? "CASH" : "INSTALLMENT",
        amount: Number(amount.toFixed(2)),
        tcp: Number(tcp.toFixed(2)),
        agent: row.agent_name || "Admin",
      });

      proj.subtotal.lots_sold += 1;
      proj.subtotal.total_amount += amount;
      proj.subtotal.total_tcp += tcp;
    });

    const projects = Array.from(projectsMap.values()).map((p) => ({
      ...p,
      subtotal: {
        lots_sold: p.subtotal.lots_sold,
        total_amount: Number(p.subtotal.total_amount.toFixed(2)),
        total_tcp: Number(p.subtotal.total_tcp.toFixed(2)),
      },
    }));

    let overallLotsSold = 0;
    let overallAmount = 0;
    let overallTcp = 0;

    const projectSummaries = projects.map((p) => {
      overallLotsSold += p.subtotal.lots_sold;
      overallAmount += p.subtotal.total_amount;
      overallTcp += p.subtotal.total_tcp;
      return {
        property_id: p.property_id,
        property_name: p.property_name,
        lots_sold: p.subtotal.lots_sold,
        sales_of_the_month: p.subtotal.total_amount,
        tcp: p.subtotal.total_tcp,
      };
    });

    return res.json({
      year,
      month,
      projects,
      summary: {
        total_lots_sold: overallLotsSold,
        overall_amount: Number(overallAmount.toFixed(2)),
        overall_tcp: Number(overallTcp.toFixed(2)),
        project_summaries: projectSummaries,
      },
    });
  } catch (error) {
    console.error("Error fetching monthly sales sheet:", error);
    return res.status(500).json({ error: "Failed to generate monthly sales sheet" });
  }
};

exports.resetDateVerifiedColumnCache = resetDateVerifiedColumnCache;
