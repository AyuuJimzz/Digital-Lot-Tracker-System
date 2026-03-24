const express = require("express");
const router = express.Router();
const sessionOrToken = require("../middleware/session_or_token");

const {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
} = require("../controllers/clientsController");

// All routes require login as employee or admin
const requireAuth = sessionOrToken({ roles: ["employee", "admin"] });

router.get("/", requireAuth, getAllClients);
router.get("/:id", requireAuth, getClientById);
router.post("/", requireAuth, createClient);
router.put("/:id", requireAuth, updateClient);
router.delete("/:id", requireAuth, deleteClient);

module.exports = router;
