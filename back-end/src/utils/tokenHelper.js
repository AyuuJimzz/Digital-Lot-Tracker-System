const jwt = require("jsonwebtoken");

/**
 * Generates a signed JWT authentication token with user claims and single-session tracking.
 * @param {object} user - User entity (id, email, role, permissions, password_reset_required)
 * @param {string|null} sessionId - Active device session ID
 * @returns {string} - Signed JWT string
 */
const generateToken = (user, sessionId) => {
  const resolvedName = user.first_name
    ? `${user.first_name} ${user.last_name || ""}`.trim()
    : (user.name || null);

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      first_name: user.first_name || null,
      last_name: user.last_name || null,
      name: resolvedName,
      sessionId: sessionId || user.sessionId || null,
      isHeadAdmin: user.isHeadAdmin || false,
      canManageEmployees: user.canManageEmployees || false,
      password_reset_required: Boolean(user.password_reset_required),
    },
    process.env.JWT_SECRET,
    { expiresIn: "30d" },
  );
};

module.exports = { generateToken };
