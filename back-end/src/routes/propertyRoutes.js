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

router.get("/", sessionOrToken({ roles: ["admin"] }), getAllProperties);
router.get("/:id", sessionOrToken({ roles: ["admin"] }), getPropertyById);
router.post("/", sessionOrToken({ roles: ["admin"] }), createProperty);
router.put("/:id", sessionOrToken({ roles: ["admin"] }), updateProperty);
router.patch(
  "/:id/status",
  sessionOrToken({ roles: ["admin"] }),
  updatePropertyStatus,
);
router.delete("/:id", sessionOrToken({ roles: ["admin"] }), deleteProperty);
module.exports = router;
