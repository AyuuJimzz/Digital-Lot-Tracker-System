const express = require("express");
const router = express.Router();
const sessionOrToken = require("../middleware/session_or_token");
const { importLots } = require("../controllers/lotImportController");
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
  getSubdivisionColors,
  saveSubdivisionColors,
  resetSubdivisionColors,
} = require("../controllers/lotsController");

const requireAuth = sessionOrToken({ roles: ["admin", "employee"] });
const requireAdmin = sessionOrToken({ roles: ["admin"] });

// Read routes
router.get("/subdivision-colors", requireAuth, getSubdivisionColors);
router.get("/map-data", requireAuth, getMapData);
router.get("/dashboard-stats", requireAuth, getDashboardStats);
router.get("/property-stats", requireAuth, getPropertyLotStats);
router.get("/monthly-sales", requireAuth, getMonthlySalesData);
router.get("/time-based-sales", requireAuth, getTimeBasedPropertySales);
router.get("/all", requireAuth, getAllLots);
router.get("/property/:propertyId", requireAuth, getLotsByProperty);
router.get("/:id", requireAuth, getLotById);

// Write / Mutation routes (Protected)
router.put("/subdivision-colors", requireAdmin, saveSubdivisionColors);
router.delete("/subdivision-colors", requireAdmin, resetSubdivisionColors);
router.post("/import", requireAdmin, importLots);
router.post("/", requireAdmin, createLot);
router.put("/:id/status", requireAuth, updateLotStatus);
router.put("/:id/coordinates", requireAdmin, updateLotCoordinates);
router.put("/:id/details", requireAdmin, updateLotDetails);
router.put("/property/:propertyId/bulk-shift", requireAdmin, bulkShiftPropertyLots);
router.delete("/:id", requireAdmin, deleteLot);
// Sending emails mutates durable reminder state; never expose it through GET.
router.post("/send-pending-reminders", requireAdmin, sendPendingLotReminders);

module.exports = router;
