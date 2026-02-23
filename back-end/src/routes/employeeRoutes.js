// routes/employeeRoutes.js
const express = require("express");
const router = express.Router();
const { getAllEmployees, createEmployee, updateEmployee, deleteEmployee } = require("../controllers/employeeController");
const requireLogin = require("../middleware/requiredLogin");

// ============================================================
// EMPLOYEE ROUTES - All routes protected with requireLogin
// ============================================================

// GET /api/employees - View all employees
router.get("/", requireLogin, getAllEmployees);

// POST /api/employees - Add new employee
router.post("/", requireLogin, createEmployee);

// PUT /api/employees/:id - Update employee
router.put("/:id", requireLogin, updateEmployee);

// DELETE /api/employees/:id - Delete employee
router.delete("/:id", requireLogin, deleteEmployee);

module.exports = router;
