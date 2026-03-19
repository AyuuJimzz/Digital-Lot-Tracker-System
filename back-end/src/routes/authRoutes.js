// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const { login, logout, checkSession } = require("../controllers/authController");
const { forgotPassword, resetPassword } = require("../controllers/passwordResetController");

router.post("/login", login);
router.post("/logout", logout);
router.get("/check-session", checkSession); // verify session
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword); // requires authentication

module.exports = router;
