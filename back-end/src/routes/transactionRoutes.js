const express = require('express');
const router = express.Router();
const { 
  getTransactions, 
  createTransaction, 
  updateTransactionStatus 
} = require('../controllers/transactionsController');

// GET /api/transactions - Get all transactions
router.get('/', getTransactions);

// POST /api/transactions - Create new transaction
router.post('/', createTransaction);

// PUT /api/transactions/:transaction_id/status - Update transaction status
router.put('/:transaction_id/status', updateTransactionStatus);

module.exports = router;
