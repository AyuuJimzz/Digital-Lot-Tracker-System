// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const { login, logout, checkSession } = require("../controllers/authController");
const { forgotPassword, resetPassword } = require("../controllers/passwordResetController");
const { getProfile, updateProfile, changePassword } = require("../controllers/profileController");
const sessionOrToken = require("../middleware/session_or_token");

router.post("/login", login);
router.post("/logout", logout);
router.get("/check-session", checkSession); // verify session
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword); // requires authentication

// Profile & Settings
router.get("/profile", sessionOrToken({ roles: ["admin", "employee"] }), getProfile);
router.put("/profile", sessionOrToken({ roles: ["admin", "employee"] }), updateProfile);
router.put("/change-password", sessionOrToken({ roles: ["admin", "employee"] }), changePassword);

module.exports = router;
