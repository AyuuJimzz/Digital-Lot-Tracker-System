const { verifyToken } = require("../middleware/authMiddleware");
const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employeeControllers");

// Protect the routes
router.get("/", verifyToken, employeeController.getAllEmployees);
router.post("/", verifyToken, employeeController.createEmployee);

module.exports = router;
