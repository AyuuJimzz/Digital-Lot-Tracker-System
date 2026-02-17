const express = require("express");
const router = express.Router();
const { loginEmployee } = require("../controllers/authController");

router.post("/login", loginEmployee);

module.exports = router;
