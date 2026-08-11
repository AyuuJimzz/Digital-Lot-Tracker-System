const jwt = require("jsonwebtoken");

const sessionOrToken = ({ roles = [], permission } = {}) => {
  return (req, res, next) => {
    try {
      // 1. Identification: Check session first, then JWT
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

      // Helper function to handle unauthorized/forbidden responses
      const frontendUrl = process.env.FRONTEND_URL || "https://golden-dragon-estate.onrender.com";
      const handleUnauthorized = (status, message, redirectPath) => {
        if (req.headers.accept && req.headers.accept.includes("text/html")) {
          return res.redirect(
            `${frontendUrl}/${redirectPath}?status=${status}&message=${encodeURIComponent(message)}`,
          );
        }
        return res.status(status).json({ message });
      };

      // 2. Not logged in
      if (!req.user) {
        return handleUnauthorized(
          401,
          "Access Denied: You must be logged in.",
          "access-denied",
        );
      }

      // 3. Role check
      if (roles.length && !roles.includes(req.user.role)) {
        return handleUnauthorized(
          403,
          "Forbidden: You do not have access.",
          "forbidden",
        );
      }

      // 4. Permission check
      if (permission && !req.user[permission]) {
        return handleUnauthorized(
          403,
          "Forbidden: Insufficient permissions.",
          "forbidden",
        );
      }

      return next();
    } catch (error) {
      // Invalid token/JWT error
      if (req.headers.accept && req.headers.accept.includes("text/html")) {
        return res.redirect(
          `${frontendUrl}/access-denied?status=401&message=${encodeURIComponent("Invalid session or token.")}`,
        );
      }
      return res
        .status(401)
        .json({ message: "Access Denied: Invalid session or token." });
    }
  };
};

module.exports = sessionOrToken;
