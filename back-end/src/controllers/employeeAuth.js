const db = require("../../config/database_connection");
// const bcrypt = require("bcryptjs");

const loginEmployee = async (email, password) => {
  try {
    const [results] = await db.query(
      "SELECT * FROM employees WHERE email = ?",
      [email],
    );
    if (!results.length) return { success: false };

    const employee = results[0];

    //Comment temporary since we done have add Employee features for bcrypt hashing
    // const match = await bcrypt.compare(password, employee.password);
    const match = password === employee.password;
    if (!match) return { success: false };

    return {
      success: true,
      message: "Login successful",
      role: "employee",
      user: {
        id: employee.employee_id,
        email: employee.email,
      },
    };
  } catch (error) {
    console.error("Employee login error:", error);
    return { success: false, error: "Server error" };
  }
};

module.exports = { loginEmployee };
