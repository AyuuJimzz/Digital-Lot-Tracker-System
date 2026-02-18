// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const { login, logout, checkSession } = require("../controllers/authController");

router.post("/login", login);
router.post("/logout", logout);
router.get("/check-session", checkSession); // verify session

module.exports = router;
