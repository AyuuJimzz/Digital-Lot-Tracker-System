// controllers/employeeController.js
const db = require("../../../config/database_connection");
const bcrypt = require("bcryptjs");

// ============================================================
// GET ALL EMPLOYEES - View all employees
// ============================================================
exports.getAllEmployees = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM employees");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================================z
// CREATE EMPLOYEE - Add new employee
// ============================================================
exports.createEmployee = async (req, res) => {
  const {
    first_name,
    last_name,
    email,
    password,
    date_of_birth,
    gender,
    phone_number,
    address,
  } = req.body;
  if (!first_name || !last_name || !email || !password) {
    return res.status(400).json({ error: "Required fields are missing" });
  }

  const query = `
    INSERT INTO employees
    (first_name, last_name, email, password, date_of_birth, gender, phone_number, address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(query, [
      first_name,
      last_name,
      email,
      hashedPassword,
      date_of_birth,
      gender,
      phone_number,
      address,
    ]);
    res
      .status(201)
      .json({ message: "Employee added", employee_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// UPDATE EMPLOYEE - Edit employee info
// ============================================================
exports.updateEmployee = async (req, res) => {
  const { id } = req.params;
  const {
    first_name,
    last_name,
    email,
    date_of_birth,
    gender,
    phone_number,
    address,
  } = req.body;

  const query = `
    UPDATE employees
    SET first_name = ?, last_name = ?, email = ?, date_of_birth = ?, 
        gender = ?, phone_number = ?, address = ?
    WHERE employee_id = ?
  `;

  try {
    const [result] = await db.query(query, [
      first_name,
      last_name,
      email,
      date_of_birth,
      gender,
      phone_number,
      address,
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json({ message: "Employee updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// DELETE EMPLOYEE - Delete employee
// ============================================================
exports.deleteEmployee = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query(
      "DELETE FROM employees WHERE employee_id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json({ message: "Employee deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
