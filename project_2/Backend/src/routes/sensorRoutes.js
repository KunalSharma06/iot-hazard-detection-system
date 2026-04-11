const express = require("express");
const router = express.Router();
const sensorCtrl = require("../controllers/sensorController");
const validateSensor = require("../middlewares/validateSensor");

router.post("/data", validateSensor, sensorCtrl.receiveData);

module.exports = router;
