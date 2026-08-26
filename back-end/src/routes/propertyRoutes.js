// routes/propertyRoutes.js
const express = require("express");
const router = express.Router();
const {
  getAllProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  updatePropertyStatus,
  deleteProperty,
} = require("../controllers/propertyController");
const sessionOrToken = require("../middleware/session_or_token");

const requireRead  = sessionOrToken({ roles: ["admin", "employee"] });
const requireAdmin = sessionOrToken({ roles: ["admin"] });

router.get("/", requireRead, getAllProperties);
router.get("/:id", requireRead, getPropertyById);
router.post("/", requireAdmin, createProperty);
router.put("/:id", requireAdmin, updateProperty);
router.patch("/:id/status", requireAdmin, updatePropertyStatus);
router.delete("/:id", requireAdmin, deleteProperty);
module.exports = router;
