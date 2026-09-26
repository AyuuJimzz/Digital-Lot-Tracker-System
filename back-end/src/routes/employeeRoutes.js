// employeeRoutes.js
const express = require("express");
const router = express.Router();
const sessionOrToken = require("../middleware/session_or_token");
const {
  getAllEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  toggleEmployeeStatus,
  getEmployeeActivities,
  getEmployeePendingLots,
  reassignPendingLots,
} = require("../controllers/Employee/employeeController");

// GET all employees
router.get(
  "/",
  sessionOrToken({ roles: ["admin", "employee"] }),
  getAllEmployees,
);

// GET employee activities (Audit Log)
router.get(
  "/:id/activities",
  sessionOrToken({ roles: ["admin"] }),
  getEmployeeActivities,
);

// GET employee pending lots (for handover)
router.get(
  "/:id/pending-lots",
  sessionOrToken({ roles: ["admin"] }),
  getEmployeePendingLots,
);

// REASSIGN employee pending lots
router.post(
  "/:id/reassign-pending",
  sessionOrToken({ roles: ["admin"] }),
  reassignPendingLots,
);

// CREATE employee
router.post("/", sessionOrToken({ roles: ["admin"] }), createEmployee);

// UPDATE employee
router.put("/:id", sessionOrToken({ roles: ["admin"] }), updateEmployee);

// TOGGLE employee status (active / inactive)
router.patch("/:id/status", sessionOrToken({ roles: ["admin"] }), toggleEmployeeStatus);

// DELETE employee
router.delete(
  "/:id",
  sessionOrToken({ roles: ["admin"] }),
  deleteEmployee,
);

module.exports = router;
