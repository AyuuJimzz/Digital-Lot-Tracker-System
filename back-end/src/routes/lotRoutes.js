const express = require("express");
const router = express.Router();
const {
  getAllLots,
  getLotsByProperty,
  getLotById,
  getMapData,
  getDashboardStats,
  getPropertyLotStats,
  getMonthlySalesData,
  getTimeBasedPropertySales,
  updateLotStatus,
  updateLotCoordinates,
  sendPendingLotReminders,
  createLot,
  deleteLot,
  bulkShiftPropertyLots,
  updateLotDetails,
} = require("../controllers/lotsController");

// Database routes
router.get("/map-data", getMapData);
router.get("/dashboard-stats", getDashboardStats);
router.get("/property-stats", getPropertyLotStats);
router.get("/monthly-sales", getMonthlySalesData);
router.get("/time-based-sales", getTimeBasedPropertySales);
router.get("/all", getAllLots);
router.get("/property/:propertyId", getLotsByProperty);

// Test route
router.get("/test-db", async (req, res) => {
  try {
    const db = require("../../config/database_connection");
    const [rows] = await db.query("SELECT COUNT(*) as count FROM lots");
    res.json({
      message: "Database connection working",
      lotCount: rows[0].count,
    });
  } catch (error) {
    console.error("Database test error:", error);
    res.status(500).json({ error: "Database connection failed", details: error.message });
  }
});

// Debug route to check specific lot
// router.get("/debug/:id", async (req, res) => {
//   try {
//     const db = require("../../config/database_connection");
//     const { id } = req.params;

//     console.log("Debug checking lot ID:", id);

//     const [lotRows] = await db.query("SELECT * FROM lots WHERE lot_id = ?", [id]);
//     const [allLots] = await db.query(
//       "SELECT lot_id, lot_number, status FROM lots ORDER BY lot_id LIMIT 10"
//     );

//     res.json({
//       requestedId: id,
//       lotExists: lotRows.length > 0,
//       lotDetails: lotRows[0] || null,
//       sampleLots: allLots,
//       totalLotCount: allLots.length,
//     });
//   } catch (error) {
//     console.error("Debug route error:", error);
//     res.status(500).json({ error: "Debug failed", details: error.message });
//   }
// });

router.get("/:id", getLotById);

// Update routes
router.post("/", createLot);
router.put("/:id/status", updateLotStatus);
router.put("/:id/coordinates", updateLotCoordinates);
router.put("/:id/details", updateLotDetails);
router.put("/property/:propertyId/bulk-shift", bulkShiftPropertyLots);
router.delete("/:id", deleteLot);
router.post("/send-pending-reminders", sendPendingLotReminders);

// Test PUT route
router.put("/test-put/:id", (req, res) => {
  console.log("Test PUT route called with ID:", req.params.id);
  res.json({ message: "PUT route working", id: req.params.id, body: req.body });
});

module.exports = router;
