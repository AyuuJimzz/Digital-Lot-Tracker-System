// routes/employeeRoutes.js
const express = require("express");
const router = express.Router();
const {
  getAllEmployees,
  createEmployee,
} = require("../controllers/employeeController");
const requireLogin = require("../middleware/requiredLogin");

// Protected routes
router.get("/", requireLogin, getAllEmployees);
router.post("/", requireLogin, createEmployee);

module.exports = router;
