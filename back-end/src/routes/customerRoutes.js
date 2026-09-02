const express = require("express");
const router = express.Router();
const sessionOrToken = require("../middleware/session_or_token");

const {
  getAllCustomers,
  getAllCustomersForMap,
  getCustomerById,
  getLotWithCustomer,
  createCustomer,
  createOrUpdateCustomer,
  updateCustomer,
  deleteCustomer,
} = require("../controllers/customersController");

// All routes require login as employee or admin
const requireAuth = sessionOrToken({ roles: ["employee", "admin"] });

router.get("/", requireAuth, getAllCustomers);
router.get("/all-for-map", requireAuth, getAllCustomersForMap);
router.get("/:id", requireAuth, getCustomerById);
router.get("/lot/:id/with-customer", requireAuth, getLotWithCustomer);
router.post("/", requireAuth, createCustomer);
router.post("/lot/:id/customer", requireAuth, createOrUpdateCustomer);
router.put("/:id", requireAuth, updateCustomer);
router.delete("/:id", requireAuth, deleteCustomer);

module.exports = router;
