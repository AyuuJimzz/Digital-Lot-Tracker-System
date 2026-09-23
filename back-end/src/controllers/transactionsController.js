const db = require("../../config/database_connection");

// Get all transactions (sold and pending lots with customer info)
const getTransactions = async (req, res) => {
  try {
    let query = `
      SELECT 
        CONCAT('TXN-', LPAD(t.transaction_id, 4, '0')) as transaction_id,
        t.lot_id,
        COALESCE(t.employee_id, c.employee_id) as employee_id,
        COALESCE(t.agent_name, NULLIF(TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))), ''), 'Admin') as agent_name,
        COALESCE(c.full_name, 'No customer assigned') as customer_name,
        l.lot_number,
        p.property_name,
        DATE_FORMAT(t.transaction_date, '%Y-%m-%d') as transaction_date,
        t.payment_type,
        CASE 
          WHEN c.customer_status = 'Cancelled' THEN 'Cancelled'
          WHEN l.status = 'Sold' OR c.customer_status = 'Sold' THEN 'Sold'
          ELSE 'Pending'
        END as status
      FROM transactions t
      JOIN lots l ON t.lot_id = l.lot_id
      LEFT JOIN customers c ON t.customer_id = c.customer_id
      LEFT JOIN employees e ON COALESCE(t.employee_id, c.employee_id) = e.employee_id
      JOIN properties p ON l.property_id = p.property_id
      WHERE (l.status IN ('Sold', 'Pending') OR c.customer_status = 'Cancelled')
    `;
    const params = [];
    if (req.user && req.user.role === "employee" && req.query.scope === "personal") {
      query += ` AND (t.employee_id = ? OR c.employee_id = ?) `;
      params.push(req.user.id, req.user.id);
    }
    query += ` ORDER BY t.transaction_date DESC, t.transaction_id DESC`;
    const [transactions] = await db.execute(query, params);
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
  let connection;
  try {
    const { lot_id, customer_id, payment_type, notes, agent_name: customAgentName, agent_id: customAgentId } = req.body;
    let employeeId = (req.user && req.user.role === "employee") ? req.user.id : (customAgentId || null);
    let agentName = customAgentName || (req.user && req.user.role === "employee" ? (req.user.name || "Employee") : "Admin");

    // Start transaction
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Create transaction record with persistent agent_name snapshot
    const insertTransactionQuery = `
      INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, agent_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result] = await connection.execute(insertTransactionQuery, [
      lot_id,
      customer_id,
      payment_type || "No Downpayment",
      notes,
      employeeId,
      agentName,
    ]);

    // Update lot status to Pending
    const updateLotQuery = `
      UPDATE lots 
      SET status = 'Pending', 
          pending_since = NOW() 
      WHERE lot_id = ?
    `;

    await connection.execute(updateLotQuery, [lot_id]);

    // Commit transaction
    await connection.commit();

    console.log(`💳 [New Transaction Created] TXN ID: ${result.insertId} | Lot #${lot_id} | Cust #${customer_id} | Payment: ${payment_type || "No Downpayment"} | Agent: ${req.user?.email || "System"}`);

    res.status(201).json({
      message: "Transaction created successfully",
      transaction_id: result.insertId,
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) {
        console.error("Error rolling back transaction creation:", rollbackError);
      }
    }
    console.error("Error creating transaction:", error);
    res.status(500).json({
      error: "Database error",
      message: "Failed to create transaction",
    });
  } finally {
    if (connection) connection.release();
  }
};

// Update transaction status (for marking as Sold)
const updateTransactionStatus = async (req, res) => {
  let connection;
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
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Update payment type
    await connection.execute("UPDATE transactions SET payment_type = ? WHERE transaction_id = ?", [
      payment_type,
      transaction_id,
    ]);

    // Update lot status to Sold
    await connection.execute('UPDATE lots SET status = "Sold", pending_since = NULL WHERE lot_id = ?', [
      lot_id,
    ]);

    // Commit transaction
    await connection.commit();

    res.json({ message: "Transaction updated successfully" });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) {
        console.error("Error rolling back transaction update:", rollbackError);
      }
    }
    console.error("Error updating transaction:", error);
    res.status(500).json({
      error: "Database error",
      message: "Failed to update transaction",
    });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  getTransactions,
  createTransaction,
  updateTransactionStatus,
};
