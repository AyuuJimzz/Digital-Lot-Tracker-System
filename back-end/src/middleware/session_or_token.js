const jwt = require("jsonwebtoken");

// options: { roles: [], permission: "somePermission" }
const sessionOrToken = ({ roles = [], permission } = {}) => {
  return (req, res, next) => {
    try {
      // --- 1. Check session or JWT ---
      if (req.session?.user) {
        req.user = req.session.user;
      } else {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
          const token = authHeader.split(" ")[1];
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          req.user = decoded;
        }
      }

      // --- 2. Not logged in → AccessDenied ---
      if (!req.user) {
        const message = "Access Denied: You must be logged in.";
        if (req.headers.accept && req.headers.accept.includes("text/html")) {
          const status = 401;
          return res.redirect(
            `http://localhost:3000/access-denied?status=${status}&message=${encodeURIComponent(message)}`,
          );
        }
        return res.status(401).json({ message });
      }

      // --- 3. Role check ---
      if (roles.length && !roles.includes(req.user.role)) {
        const message = "Forbidden: You do not have access.";
        if (req.headers.accept && req.headers.accept.includes("text/html")) {
          const status = 403;
          return res.redirect(
            `http://localhost:3000/forbidden?status=${status}&message=${encodeURIComponent(message)}`,
          );
        }
        return res.status(403).json({ message });
      }

      // --- 4. Permission check ---
      if (permission && !req.user[permission]) {
        const message = "Forbidden: You do not have access.";
        if (req.headers.accept && req.headers.accept.includes("text/html")) {
          const status = 403;
          return res.redirect(
            `http://localhost:3000/forbidden?status=${status}&message=${encodeURIComponent(message)}`,
          );
        }
        return res.status(403).json({ message });
      }

      // ✅ All good → continue
      return next();
    } catch (error) {
      // Invalid token → AccessDenied
      const message = "Access Denied: Invalid session or token.";
      if (req.headers.accept && req.headers.accept.includes("text/html")) {
        const status = 401;
        return res.redirect(
          `http://localhost:3000/access-denied?status=${status}&message=${encodeURIComponent(message)}`,
        );
      }
      return res.status(401).json({ message });
    }
  };
};

module.exports = sessionOrToken;
