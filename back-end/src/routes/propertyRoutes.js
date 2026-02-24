// routes/propertyRoutes.js
const express = require("express");
const router = express.Router();
const { getAllProperties, getPropertyById, createProperty, updateProperty, updatePropertyStatus, deleteProperty } = require("../controllers/propertyController");
const requireLogin = require("../middleware/requiredLogin");

// ============================================================
// PROPERTY ROUTES - All routes protected with requireLogin
// ============================================================

// GET /api/properties - View all properties
router.get("/", requireLogin, getAllProperties);

// GET /api/properties/:id - View single property
router.get("/:id", requireLogin, getPropertyById);

// POST /api/properties - Add new property
router.post("/", requireLogin, createProperty);

// PUT /api/properties/:id - Update property
router.put("/:id", requireLogin, updateProperty);

// PATCH /api/properties/:id/status - Update property status
router.patch("/:id/status", requireLogin, updatePropertyStatus);

// DELETE /api/properties/:id - Delete property
router.delete("/:id", requireLogin, deleteProperty);

module.exports = router;
