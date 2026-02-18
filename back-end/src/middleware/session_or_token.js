const { requireLogin } = require("../controllers/authController");

const sessionOrToken = (req, res, next) => {
  // session takes priority
  if (req.session?.user) {
    req.user = req.session.user;
    return next();
  }
  // fallback to your dummy-token
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token || !token.startsWith("dummy-token-")) {
      return res.status(401).json({ message: "Access denied" });
    }
    const employee_id = token.replace("dummy-token-", "");
    req.user = { employee_id };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = { sessionOrToken };
