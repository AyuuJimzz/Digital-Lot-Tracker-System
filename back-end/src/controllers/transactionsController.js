const db = require("../../config/database_connection");

// Get all transactions (sold and pending lots with customer info)
const getTransactions = async (req, res) => {
  try {
    const query = `
      SELECT 
        CONCAT('TXN-', LPAD(t.transaction_id, 4, '0')) as transaction_id,
        COALESCE(c.full_name, 'No customer assigned') as customer_name,
        l.lot_number,
        p.property_name,
        DATE_FORMAT(t.transaction_date, '%Y-%m-%d') as transaction_date,
        t.payment_type,
        l.status
      FROM transactions t
      JOIN lots l ON t.lot_id = l.lot_id
      LEFT JOIN customers c ON t.customer_id = c.customer_id
      JOIN properties p ON l.property_id = p.property_id
      WHERE l.status IN ('Sold', 'Pending')
      ORDER BY t.transaction_date DESC
    `;
    const [transactions] = await db.execute(query);
    res.json(transactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({
      error: "Database error",
      message: "Failed to fetch transactions",
    });
  }
};

// Create new transaction
const createTransaction = async (req, res) => {
  try {
    const { lot_id, customer_id, payment_type, notes } = req.body;

    // Start transaction
    await db.beginTransaction();

    // Create transaction record
    const insertTransactionQuery = `
      INSERT INTO transactions (lot_id, customer_id, payment_type, notes)
      VALUES (?, ?, ?, ?)
    `;

    const [result] = await db.execute(insertTransactionQuery, [
      lot_id,
      customer_id,
      payment_type || "No Downpayment",
      notes,
    ]);

    // Update lot status to Pending
    const updateLotQuery = `
      UPDATE lots 
      SET status = 'Pending', 
          pending_since = NOW() 
      WHERE lot_id = ?
    `;

    await db.execute(updateLotQuery, [lot_id]);

    // Commit transaction
    await db.commit();

    res.status(201).json({
      message: "Transaction created successfully",
      transaction_id: result.insertId,
    });
  } catch (error) {
    await db.rollback();
    console.error("Error creating transaction:", error);
    res.status(500).json({
      error: "Database error",
      message: "Failed to create transaction",
    });
  }
};

// Update transaction status (for marking as Sold)
const updateTransactionStatus = async (req, res) => {
  try {
    const { transaction_id } = req.params;
    const { payment_type } = req.body;

    // Get lot_id from transaction
    const [transaction] = await db.execute(
      "SELECT lot_id FROM transactions WHERE transaction_id = ?",
      [transaction_id]
    );

    if (transaction.length === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const lot_id = transaction[0].lot_id;

    // Start transaction
    await db.beginTransaction();

    // Update payment type
    await db.execute("UPDATE transactions SET payment_type = ? WHERE transaction_id = ?", [
      payment_type,
      transaction_id,
    ]);

    // Update lot status to Sold
    await db.execute('UPDATE lots SET status = "Sold", pending_since = NULL WHERE lot_id = ?', [
      lot_id,
    ]);

    // Commit transaction
    await db.commit();

    res.json({ message: "Transaction updated successfully" });
  } catch (error) {
    await db.rollback();
    console.error("Error updating transaction:", error);
    res.status(500).json({
      error: "Database error",
      message: "Failed to update transaction",
    });
  }
};

module.exports = {
  getTransactions,
  createTransaction,
  updateTransactionStatus,
};
