// controllers/employeeController.js
const db = require("../../config/database_connection");

exports.getAllEmployees = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM employees");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

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
    const [result] = await db.query(query, [
      first_name,
      last_name,
      email,
      password,
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
