const express = require("express");
const router = express.Router();

// Employee controller
const {
  getAllEmployees,
  createEmployee,
} = require("../controllers/employeeController");

// Auth controller for session middleware
const { requireLogin } = require("../controllers/authController");

// Protected routes
router.get("/", requireLogin, getAllEmployees);
router.post("/", requireLogin, createEmployee);

module.exports = router;
