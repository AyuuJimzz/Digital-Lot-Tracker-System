// employeeRoutes.js
const express = require("express");
const router = express.Router();
const sessionOrToken = require("../middleware/session_or_token");
const {
  getAllEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} = require("../controllers/Employee/employeeController");

// GET all employees
router.get(
  "/",
  sessionOrToken({ roles: ["admin", "employee"] }),
  getAllEmployees,
);

// CREATE employee
router.post("/", sessionOrToken({ roles: ["admin"] }), createEmployee);

// UPDATE employee
router.put("/:id", sessionOrToken({ roles: ["admin"] }), updateEmployee);

// DELETE employee
router.delete(
  "/:id",
  sessionOrToken({ roles: ["admin"] }),
  deleteEmployee,
);

module.exports = router;
