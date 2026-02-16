const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employeeControllers");

router.get("/", employeeController.getAllEmployees);
router.post("/", employeeController.createEmployee);

module.exports = router;
