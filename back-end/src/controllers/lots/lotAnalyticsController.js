// controllers/lots/lotAnalyticsController.js
const db = require("../../../config/database_connection");
const { isNonSaleableLot, NON_SALEABLE_SQL_CONDITION } = require("../../utils/lotClassification");

// =======================
// DASHBOARD STATISTICS
// =======================
exports.getDashboardStats = async (req, res) => {
  try {
    // Get all lots statistics with is_non_saleable and lot_number to isolate saleable inventory
    const [allLots] = await db.query(`SELECT lot_id, lot_number, status, is_non_saleable FROM lots`);

    const totalParcels = allLots.length;
    const nonSaleableLots = allLots.filter((lot) => isNonSaleableLot(lot)).length;
    const totalLots = totalParcels - nonSaleableLots; // Saleable inventory
    const availableLots = allLots.filter((lot) => lot.status === "Available" && !isNonSaleableLot(lot)).length;
    const pendingLots = allLots.filter((lot) => lot.status === "Pending" && !isNonSaleableLot(lot)).length;
    const soldLots = allLots.filter((lot) => lot.status === "Sold" && !isNonSaleableLot(lot)).length;

    // Get total customers (distinct by email)
    const [customers] = await db.query(`
      SELECT COUNT(DISTINCT c.email) as count 
      FROM customers c
    `);
    const totalClients = customers[0].count;

    const stats = {
      totalLots, // Saleable lots (Available + Pending + Sold) -> Exact math match!
      availableLots,
      pendingLots,
      soldLots,
      totalParcels, // Cadastral parcel count (including parks, open spaces, excluded lots)
      nonSaleableLots,
      totalClients,
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
      ORDER BY p.property_name
    `;

    const [rows] = await db.query(query);

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

// =======================
// MONTHLY SALES DATA
// =======================
exports.getMonthlySalesData = async (req, res) => {
  try {
    // Get monthly sales data for the current year
    const query = `
      SELECT 
        MONTH(t.transaction_date) as month,
        COUNT(*) as lotsSold
      FROM transactions t
      INNER JOIN lots l ON t.lot_id = l.lot_id
      WHERE YEAR(t.transaction_date) = YEAR(CURRENT_DATE)
        AND l.status = 'Sold'
      GROUP BY MONTH(t.transaction_date)
      ORDER BY MONTH(t.transaction_date)
    `;

    const [rows] = await db.query(query);

    // Create array for all 12 months
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
      const monthData = rows.find((row) => row.month === index + 1);
      return {
        month: month,
        lotsSold: monthData ? monthData.lotsSold : 0,
      };
    });

    res.json(monthlyData);
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
    const { period } = req.query; // today, week, month, year

    let dateFilter = "";

    switch (period?.toLowerCase()) {
      case "today":
        dateFilter = "DATE(t.transaction_date) = CURDATE()";
        break;
      case "week":
      case "this week":
        dateFilter = "YEARWEEK(t.transaction_date, 1) = YEARWEEK(CURDATE(), 1)";
        break;
      case "month":
      case "this month":
        dateFilter =
          "MONTH(t.transaction_date) = MONTH(CURDATE()) AND YEAR(t.transaction_date) = YEAR(CURDATE())";
        break;
      case "year":
      case "this year":
        dateFilter = "YEAR(t.transaction_date) = YEAR(CURDATE())";
        break;
      case "all":
      case "all time":
        dateFilter = "1=1";
        break;
      default:
        dateFilter =
          "MONTH(t.transaction_date) = MONTH(CURDATE()) AND YEAR(t.transaction_date) = YEAR(CURDATE())";
    }

    const query = `
      SELECT 
        p.property_id,
        p.property_name,
        p.total_lots,
        COUNT(l.lot_id) as actual_lots,
        SUM(CASE WHEN l.status = 'Sold' AND NOT ${NON_SALEABLE_SQL_CONDITION} AND EXISTS (
          SELECT 1 FROM transactions t WHERE t.lot_id = l.lot_id AND ${dateFilter}
        ) THEN 1 ELSE 0 END) as sold_lots,
        SUM(CASE WHEN ${NON_SALEABLE_SQL_CONDITION} THEN 1 ELSE 0 END) as non_saleable_lots
      FROM properties p
      LEFT JOIN lots l ON p.property_id = l.property_id
      WHERE p.status = 'active'
      GROUP BY p.property_id, p.property_name, p.total_lots
      ORDER BY p.property_name
    `;

    const [rows] = await db.query(query);

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
