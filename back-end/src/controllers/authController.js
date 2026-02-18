// controllers/authController.js
const { loginAdmin } = require("./adminAuth");
const { loginEmployee } = require("./employeeAuth");

// LOGIN
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password are required" });

  const employeeResult = await loginEmployee(email, password);
  if (employeeResult.success) {
    req.session.user = { ...employeeResult.user, role: "employee" };
    return res.json(employeeResult);
  }

  const adminResult = await loginAdmin(email, password);
  if (adminResult.success) {
    req.session.user = { ...adminResult.user, role: "admin" };
    return res.json(adminResult);
  }

  res.status(401).json({ message: "Invalid email or password" });
};

// LOGOUT
const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ message: "Logout failed" });
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out successfully" });
  });
};

// CHECK SESSION
const checkSession = (req, res) => {
  if (req.session.user) {
    return res.json({
      role: req.session.user.role,
      email: req.session.user.email,
    });
  }
  return res.status(401).json({ message: "Not logged in" });
};

module.exports = { login, logout, checkSession };
