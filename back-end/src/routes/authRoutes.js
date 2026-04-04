// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const { login, logout, checkSession } = require("../controllers/authController");
const { forgotPassword, resetPassword } = require("../controllers/passwordResetController");
const { getProfile, updateProfile, changePassword } = require("../controllers/profileController");

router.post("/login", login);
router.post("/logout", logout);
router.get("/check-session", checkSession); // verify session
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword); // requires authentication

// Profile & Settings
router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.put("/change-password", changePassword);

module.exports = router;
