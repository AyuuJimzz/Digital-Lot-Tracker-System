const express = require("express");
const router = express.Router();
const {
  getAllLots,
  getLotsByProperty,
  getLotById,
  getMapData,
} = require("../controllers/lotsController");

// Database routes
router.get("/map-data", getMapData);
router.get("/all", getAllLots);
router.get("/property/:propertyId", getLotsByProperty);
router.get("/:id", getLotById);

module.exports = router;
