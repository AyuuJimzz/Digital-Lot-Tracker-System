const express = require("express");
const router = express.Router();
const {
  loginEmployee,
  logout,
  checkSession,
} = require("../controllers/authController");

router.post("/login", loginEmployee);
router.post("/logout", logout);
//verify front-end session
router.get("/check-session", checkSession);

module.exports = router;
