const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const configPath = path.join(__dirname, "../../config/system_state.json");

// Helper to get active auth revocation timestamp
function getAuthRevocationTimestamp() {
  try {
    if (fs.existsSync(configPath)) {
      const state = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (state.authRevocationTimestamp) {
        return new Date(state.authRevocationTimestamp).getTime();
      }
    }
  } catch (err) {}
  return 0;
}

const sessionOrToken = ({ roles = [], permission } = {}) => {
  return (req, res, next) => {
    // Helper function to handle unauthorized/forbidden responses
    const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || "http://localhost:3000";
    const handleUnauthorized = (status, message, redirectPath) => {
      if (req.headers.accept && req.headers.accept.includes("text/html")) {
        return res.redirect(
          `${frontendUrl}/${redirectPath}?status=${status}&message=${encodeURIComponent(message)}`,
        );
      }
      return res.status(status).json({ message });
    };

    try {
      const revocationMs = getAuthRevocationTimestamp();

      // 1. Identification: Check session first, then JWT
      if (req.session?.user) {
        const sessionCreatedAt = req.session.createdAt ? new Date(req.session.createdAt).getTime() : 0;
        if (revocationMs > 0 && sessionCreatedAt < revocationMs) {
          req.session.destroy();
          req.user = null;
        } else {
          req.user = req.session.user;
        }
      } else {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
          const token = authHeader.split(" ")[1];
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          
          // Check if JWT was issued before global kill switch timestamp
          const tokenIssuedMs = (decoded.iat || 0) * 1000;
          if (revocationMs > 0 && tokenIssuedMs < revocationMs) {
            return handleUnauthorized(
              401,
              "Access Denied: Session revoked by Developer Global Kill Switch. Please log in again.",
              "access-denied"
            );
          }
          req.user = decoded;
        }
      }

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
