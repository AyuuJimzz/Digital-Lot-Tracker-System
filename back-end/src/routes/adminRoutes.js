const express = require("express");
const router = express.Router();
const sessionOrToken = require("../middleware/session_or_token");

const adminController = require("../controllers/Admin/adminController");
const {
  getAllEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} = require("../controllers/Employee/employeeController");

// Admin Dashboard
router.get(
  "/dashboard",
  sessionOrToken({ roles: ["admin"] }),
  adminController.dashboard,
);

// Admin Profile
router.get(
  "/profile",
  sessionOrToken({ roles: ["admin"] }),
  adminController.getProfile,
);
router.get(
  "/employees",
  sessionOrToken({ roles: ["admin"], permission: "canManageEmployees" }),
  getAllEmployees,
);

// CREATE employee
router.post(
  "/employees",
  sessionOrToken({ roles: ["admin"], permission: "canManageEmployees" }),
  createEmployee,
);

// UPDATE employee
router.put(
  "/employees/:id",
  sessionOrToken({ roles: ["admin"], permission: "canManageEmployees" }),
  updateEmployee,
);

// DELETE employee - CEO only
router.delete(
  "/employees/:id",
  sessionOrToken({ roles: ["admin"], permission: "isHeadAdmin" }),
  deleteEmployee,
);

module.exports = router;
