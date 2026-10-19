const db = require("../../config/database_connection");
const { isNonSaleableLot } = require("../utils/lotClassification");

const requestError = (status, message) => Object.assign(new Error(message), { status });

async function getCreditedAgent(connection, employeeId) {
  if (employeeId == null) return "Admin";
  const [rows] = await connection.query(
    "SELECT first_name, last_name FROM employees WHERE employee_id = ?",
    [employeeId]
  );
  if (!rows.length) throw requestError(409, "The assigned employee no longer exists.");
  return `${rows[0].first_name} ${rows[0].last_name || ""}`.trim() || "Agent";
}

// Get all transactions (sold and pending lots with customer info)
const getTransactions = async (req, res) => {
  try {
    let query = `
      SELECT 
        CONCAT('TXN-', LPAD(t.transaction_id, 4, '0')) as transaction_id,
        t.lot_id,
        CASE
          WHEN t.agent_name = 'Old Record' THEN NULL
          WHEN t.agent_name IS NOT NULL AND t.employee_id IS NULL AND t.agent_name != 'Admin' THEN NULL
          ELSE COALESCE(t.employee_id, c.employee_id)
        END as employee_id,
        COALESCE(t.agent_name, NULLIF(TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))), ''), 'Admin') as agent_name,
        CASE
          WHEN t.agent_name = 'Old Record' THEN 'legacy'
          WHEN t.agent_name IS NOT NULL AND t.employee_id IS NULL AND t.agent_name != 'Admin' THEN 'external'
          WHEN (CASE WHEN t.agent_name = 'Old Record' THEN NULL WHEN t.agent_name IS NOT NULL AND t.employee_id IS NULL AND t.agent_name != 'Admin' THEN NULL ELSE COALESCE(t.employee_id, c.employee_id) END) IS NULL AND (t.agent_name IS NULL OR t.agent_name = 'Admin') THEN 'admin'
          WHEN (CASE WHEN t.agent_name = 'Old Record' THEN NULL WHEN t.agent_name IS NOT NULL AND t.employee_id IS NULL AND t.agent_name != 'Admin' THEN NULL ELSE COALESCE(t.employee_id, c.employee_id) END) IS NULL AND t.agent_name IS NOT NULL THEN 'external'
          WHEN e.status = 'active' THEN 'active'
          ELSE 'inactive'
        END as agent_status,
        COALESCE(c.full_name, 'No customer assigned') as customer_name,
        l.lot_number,
        p.property_name,
        DATE_FORMAT(COALESCE(t.transaction_date, l.sold_on), '%Y-%m-%d') as transaction_date,
        t.payment_type,
        t.total_contract_price,
        t.downpayment,
        t.terms_months,
        t.monthly_amortization,
        CASE 
          WHEN t.agent_name = 'Old Record' THEN 1
          WHEN l.status = 'Sold' AND (l.sold_on IS NULL OR CAST(l.sold_on AS CHAR) IN ('', '0000-00-00')) THEN 1
          WHEN YEAR(COALESCE(t.transaction_date, l.sold_on)) < YEAR(CURRENT_DATE) THEN 1
          ELSE 0
        END as is_historical,
        CASE
          WHEN t.payment_type IN ('Reversal', 'Cancelled') THEN 'Cancelled'
          WHEN c.customer_status = 'Cancelled' THEN 'Cancelled'
          WHEN EXISTS (
            SELECT 1 FROM transactions rev
            WHERE rev.lot_id = l.lot_id
              AND rev.payment_type = 'Reversal'
              AND rev.transaction_id > t.transaction_id
          ) THEN 'Cancelled'
          WHEN l.status = 'Sold' AND (c.customer_status = 'Sold' OR c.customer_status IS NULL) THEN 'Sold'
          WHEN c.customer_status = 'Sold' AND l.status != 'Sold' THEN 'Cancelled'
          ELSE 'Pending'
        END as status
      FROM transactions t
      JOIN lots l ON t.lot_id = l.lot_id
      LEFT JOIN customers c ON t.customer_id = c.customer_id
      LEFT JOIN employees e ON (
        CASE
          WHEN t.agent_name = 'Old Record' THEN NULL
          WHEN t.agent_name IS NOT NULL AND t.employee_id IS NULL AND t.agent_name != 'Admin' THEN NULL
          ELSE COALESCE(t.employee_id, c.employee_id)
        END
      ) = e.employee_id
      JOIN properties p ON l.property_id = p.property_id
      WHERE (
        l.status IN ('Sold', 'Pending')
        OR c.customer_status = 'Cancelled'
        OR t.payment_type IN ('Reversal', 'Cancelled')
      )
    `;
    const params = [];
    if (req.user && req.user.role === "employee" && req.query.scope === "personal") {
      query += ` AND (t.employee_id = ? OR
        (t.employee_id IS NULL AND t.agent_name IS NULL AND c.employee_id = ?)) `;
      params.push(req.user.id, req.user.id);
    }
    query += ` ORDER BY t.transaction_date DESC, t.transaction_id DESC`;
    const dbToUse = req.db || db;
    const [transactions] = await dbToUse.execute(query, params);
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
    const { lot_id, customer_id, payment_type, notes, agent_id: requestedAgentId } = req.body;
    const lotId = Number(lot_id);
    const customerId = Number(customer_id);
    if (!Number.isInteger(lotId) || lotId <= 0 || !Number.isInteger(customerId) || customerId <= 0) {
      throw requestError(400, "A valid lot and customer are required.");
    }

    connection = await (req.db || db).getConnection();
    await connection.beginTransaction();

    const [lotRows] = await connection.query(
      "SELECT * FROM lots WHERE lot_id = ? FOR UPDATE",
      [lotId]
    );
    if (!lotRows.length) throw requestError(404, "Lot not found");

    const lot = lotRows[0];
    if (isNonSaleableLot(lot)) {
      throw requestError(400, "Non-saleable lots cannot be reserved or sold.");
    }
    if (lot.status !== "Available") {
      throw requestError(409, "Only an Available lot can receive a new reservation transaction.");
    }

    const [customers] = await connection.query(
      `SELECT customer_id, employee_id, customer_status FROM customers
       WHERE lot_id = ? ORDER BY updated_at DESC, customer_id DESC LIMIT 1 FOR UPDATE`,
      [lotId]
    );
    const customer = customers[0];
    if (!customer || Number(customer.customer_id) !== customerId ||
        !["Pending", null].includes(customer.customer_status)) {
      throw requestError(409, "The customer is not the current reservation for this lot.");
    }
    if (req.user?.role === "employee" &&
        (customer.employee_id == null || Number(customer.employee_id) !== Number(req.user.id))) {
      throw requestError(403, "Only the assigned agent or an Admin can create this transaction.");
    }
    if (req.user?.role === "admin" && requestedAgentId != null &&
        Number(requestedAgentId) !== Number(customer.employee_id)) {
      throw requestError(409, "Reassign the reservation before crediting a different agent.");
    }

    const [existing] = await connection.query(
      "SELECT transaction_id FROM transactions WHERE lot_id = ? AND customer_id = ? LIMIT 1 FOR UPDATE",
      [lotId, customerId]
    );
    if (existing.length) throw requestError(409, "This reservation already has a transaction.");

    const employeeId = customer.employee_id;
    const agentName = await getCreditedAgent(connection, employeeId);
    const { total_contract_price, downpayment, terms_months, monthly_amortization } = req.body;
    const [result] = await connection.query(
      `INSERT INTO transactions (lot_id, customer_id, payment_type, notes, employee_id, agent_name, total_contract_price, downpayment, terms_months, monthly_amortization)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lotId,
        customerId,
        payment_type || "No Downpayment",
        notes,
        employeeId,
        agentName,
        total_contract_price != null && total_contract_price !== "" ? Number(total_contract_price) : null,
        downpayment != null && downpayment !== "" ? Number(downpayment) : null,
        terms_months != null && terms_months !== "" ? parseInt(terms_months, 10) : null,
        monthly_amortization != null && monthly_amortization !== "" ? Number(monthly_amortization) : null,
      ]
    );

    await connection.query(
      "UPDATE lots SET status = 'Pending', pending_since = NOW(), last_reminder_sent = NULL WHERE lot_id = ?",
      [lotId]
    );
    await connection.commit();

    console.log(`💳 [New Transaction Created] TXN ID: ${result.insertId} | Lot #${lotId} | Cust #${customerId} | Payment: ${payment_type || "No Downpayment"} | Agent: ${req.user?.email || "System"}`);

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
    if (!error.status) console.error("Error creating transaction:", error);
    res.status(error.status || 500).json({ error: error.status ? error.message : "Failed to create transaction" });
  } finally {
    if (connection) connection.release();
  }
};

// Update transaction status (for marking as Sold)
const updateTransactionStatus = async (req, res) => {
  let connection;
  try {
    const transactionId = Number(req.params.transaction_id);
    const { payment_type } = req.body;
    if (!Number.isInteger(transactionId) || transactionId <= 0) {
      throw requestError(400, "Invalid transaction ID.");
    }

    const dbToUse = req.db || db;
    const [transaction] = await dbToUse.query(
      "SELECT lot_id FROM transactions WHERE transaction_id = ?",
      [transactionId]
    );
    if (!transaction.length) throw requestError(404, "Transaction not found");

    const lot_id = transaction[0].lot_id;
    connection = await dbToUse.getConnection();
    await connection.beginTransaction();

    const [lotRows] = await connection.query(
      "SELECT * FROM lots WHERE lot_id = ? FOR UPDATE",
      [lot_id]
    );
    if (!lotRows.length) throw requestError(404, "Lot not found");

    const lot = lotRows[0];
    if (isNonSaleableLot(lot)) {
      throw requestError(400, "Non-saleable lots cannot be marked as Sold.");
    }
    if (lot.status !== "Pending") throw requestError(409, "Only a Pending reservation can be marked as Sold.");

    const [transactionRows] = await connection.query(
      "SELECT lot_id, customer_id, employee_id FROM transactions WHERE transaction_id = ? FOR UPDATE",
      [transactionId]
    );
    if (!transactionRows.length || Number(transactionRows[0].lot_id) !== Number(lot_id) ||
        transactionRows[0].customer_id == null) {
      throw requestError(409, "The transaction is not linked to an active reservation.");
    }

    const [customers] = await connection.query(
      `SELECT customer_id, employee_id, customer_status FROM customers
       WHERE lot_id = ? ORDER BY updated_at DESC, customer_id DESC LIMIT 1 FOR UPDATE`,
      [lot_id]
    );
    const customer = customers[0];
    if (!customer || Number(customer.customer_id) !== Number(transactionRows[0].customer_id) ||
        !["Pending", null].includes(customer.customer_status)) {
      throw requestError(409, "This transaction is not for the current pending customer.");
    }
    const creditedEmployeeId = transactionRows[0].employee_id;
    if ((creditedEmployeeId == null) !== (customer.employee_id == null) ||
        (creditedEmployeeId != null && Number(creditedEmployeeId) !== Number(customer.employee_id))) {
      throw requestError(409, "Reservation and transaction agent assignments do not match.");
    }
    if (req.user?.role === "employee" &&
        (customer.employee_id == null || Number(customer.employee_id) !== Number(req.user.id))) {
      throw requestError(403, "Only the assigned agent or an Admin can complete this sale.");
    }

    const [cols] = await connection.query(
      "SHOW COLUMNS FROM transactions WHERE Field IN ('is_date_verified', 'date_provenance')"
    );
    if (cols.length < 2) {
      throw requestError(
        409,
        "Cannot complete sale: database schema is missing date provenance columns. Please run migration first."
      );
    }

    await connection.query(
      "UPDATE transactions SET payment_type = ?, transaction_date = NOW(), is_date_verified = 1, date_provenance = 'system_recorded' WHERE transaction_id = ?",
      [payment_type || "Cash", transactionId]
    );
    await connection.query("UPDATE customers SET customer_status = 'Sold', updated_at = NOW() WHERE customer_id = ?", [customer.customer_id]);
    await connection.query("UPDATE lots SET status = 'Sold', sold_on = DATE(UTC_TIMESTAMP() + INTERVAL 8 HOUR), pending_since = NULL, last_reminder_sent = NULL WHERE lot_id = ?", [lot_id]);
    await connection.commit();

    res.json({ message: "Transaction updated successfully" });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) {
        console.error("Error rolling back transaction update:", rollbackError);
      }
    }
    if (!error.status) console.error("Error updating transaction:", error);
    res.status(error.status || 500).json({ error: error.status ? error.message : "Failed to update transaction" });
  } finally {
    if (connection) connection.release();
  }
};

// Get list of unique external sales agents for autocomplete
const getExternalAgents = async (req, res) => {
  try {
    const dbToUse = req.db || db;
    const [rows] = await dbToUse.query(`
      SELECT DISTINCT TRIM(t.agent_name) as agent_name
      FROM transactions t
      WHERE t.agent_name IS NOT NULL
        AND TRIM(t.agent_name) != ''
        AND t.agent_name NOT IN ('Admin', 'Old Record', 'Legacy Record')
        AND t.employee_id IS NULL
      ORDER BY agent_name ASC
    `);
    const agents = rows.map((r) => r.agent_name).filter(Boolean);
    res.json(agents);
  } catch (error) {
    console.error("Error fetching external agents:", error);
    res.status(500).json({ error: "Failed to fetch external agents" });
  }
};

module.exports = {
  getTransactions,
  createTransaction,
  updateTransactionStatus,
  getExternalAgents,
};
