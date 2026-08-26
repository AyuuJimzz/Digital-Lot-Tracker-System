const express = require("express");
const router = express.Router();
const sessionOrToken = require("../middleware/session_or_token");
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

const requireAuth = sessionOrToken({ roles: ["admin", "employee"] });
const requireAdmin = sessionOrToken({ roles: ["admin"] });

// Read routes
router.get("/map-data", getMapData);
router.get("/dashboard-stats", requireAuth, getDashboardStats);
router.get("/property-stats", requireAuth, getPropertyLotStats);
router.get("/monthly-sales", requireAuth, getMonthlySalesData);
router.get("/time-based-sales", requireAuth, getTimeBasedPropertySales);
router.get("/all", getAllLots);
router.get("/property/:propertyId", getLotsByProperty);
router.get("/:id", getLotById);

// Write / Mutation routes (Protected)
router.post("/", requireAdmin, createLot);
router.put("/:id/status", requireAuth, updateLotStatus);
router.put("/:id/coordinates", requireAdmin, updateLotCoordinates);
router.put("/:id/details", requireAdmin, updateLotDetails);
router.put("/property/:propertyId/bulk-shift", requireAdmin, bulkShiftPropertyLots);
router.delete("/:id", requireAdmin, deleteLot);
router.post("/send-pending-reminders", requireAuth, sendPendingLotReminders);
router.get("/send-pending-reminders", requireAuth, sendPendingLotReminders);

module.exports = router;
