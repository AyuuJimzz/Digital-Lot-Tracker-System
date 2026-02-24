// routes/propertyRoutes.js
const express = require("express");
const router = express.Router();
const { getAllProperties, getPropertyById, createProperty, updateProperty, updatePropertyStatus, deleteProperty } = require("../controllers/propertyController");
const sessionOrToken = require("../middleware/session_or_token");

// ============================================================
// PROPERTY ROUTES - All routes protected with sessionOrToken (admin only)
// ============================================================

// GET /api/properties - View all properties
router.get("/", sessionOrToken({ roles: ["admin"] }), getAllProperties);

// GET /api/properties/:id - View single property
router.get("/:id", sessionOrToken({ roles: ["admin"] }), getPropertyById);

// POST /api/properties - Add new property
router.post("/", sessionOrToken({ roles: ["admin"] }), createProperty);

// PUT /api/properties/:id - Update property
router.put("/:id", sessionOrToken({ roles: ["admin"] }), updateProperty);

// PATCH /api/properties/:id/status - Update property status
router.patch("/:id/status", sessionOrToken({ roles: ["admin"] }), updatePropertyStatus);

// DELETE /api/properties/:id - Delete property
router.delete("/:id", sessionOrToken({ roles: ["admin"] }), deleteProperty);

module.exports = router;
