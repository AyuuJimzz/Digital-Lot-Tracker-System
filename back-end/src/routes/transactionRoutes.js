const express = require("express");
const router = express.Router();
const sessionOrToken = require("../middleware/session_or_token");
const {
  getTransactions,
  createTransaction,
  updateTransactionStatus,
  getExternalAgents,
} = require("../controllers/transactionsController");

const requireAuth = sessionOrToken({ roles: ["admin", "employee"] });

// GET /api/transactions/agents - Get unique external sales agent suggestions
router.get("/agents", requireAuth, getExternalAgents);

// GET /api/transactions - Get all transactions
router.get("/", requireAuth, getTransactions);

// POST /api/transactions - Create new transaction
router.post("/", requireAuth, createTransaction);

// PUT /api/transactions/:transaction_id/status - Update transaction status
router.put("/:transaction_id/status", requireAuth, updateTransactionStatus);

module.exports = router;
