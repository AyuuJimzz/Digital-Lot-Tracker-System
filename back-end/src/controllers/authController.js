const db = require("../../config/database_connection");

const loginEmployee = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const [employeeResults] = await db.query(
      "SELECT * FROM employees WHERE email = ?",
      [email],
    );

    if (employeeResults.length > 0) {
      const employee = employeeResults[0];
      if (password === employee.password) {
        req.session.user = {
          id: employee.employee_id,
          email: employee.email,
          role: "employee",
        };
        return res
          .status(200)
          .json({ message: "Login successful", role: "employee" });
      }
    }

    const [adminResults] = await db.query(
      "SELECT * FROM admins WHERE email = ?",
      [email],
    );

    if (adminResults.length > 0) {
      const admin = adminResults[0];
      if (password === admin.password) {
        req.session.user = {
          id: admin.admin_id,
          email: admin.email,
          role: "admin",
        };
        return res
          .status(200)
          .json({ message: "Login successful", role: "admin" });
      }
    }

    return res.status(401).json({ message: "Invalid email or password" });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ message: "Logout failed" });
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out successfully" });
  });
};

const checkSession = (req, res) => {
  if (req.session.user) {
    return res.json({
      role: req.session.user.role,
      email: req.session.user.email,
    });
  }
  return res.status(401).json({ message: "Not logged in" });
};

// PROTECT ROUTES
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Please log in first" });
  }
  next();
};

module.exports = {
  loginEmployee,
  logout,
  checkSession,
  requireLogin,
};
