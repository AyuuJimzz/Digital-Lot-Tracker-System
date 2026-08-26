// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { login, logout, checkSession } = require("../controllers/authController");
const { forgotPassword, resetPassword } = require("../controllers/passwordResetController");
const { getProfile, updateProfile, changePassword } = require("../controllers/profileController");
const sessionOrToken = require("../middleware/session_or_token");

const requireAuth = sessionOrToken({ roles: ["admin", "employee"] });

// Rate limit specifically for actual credential verification (login & forgot-password)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 failed login attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again after 15 minutes." },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many password reset attempts. Please try again after 15 minutes." },
});

// Login & Auth
router.post("/login", loginLimiter, login);
router.post("/logout", logout);
router.get("/check-session", checkSession); // NOT rate limited (frequently called by frontend)
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/reset-password", requireAuth, resetPassword);

// Profile & Settings
router.get("/profile", requireAuth, getProfile);
router.put("/profile", requireAuth, updateProfile);
router.put("/change-password", requireAuth, changePassword);

module.exports = router;
