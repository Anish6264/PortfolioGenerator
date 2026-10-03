const express = require("express");
const protect = require("../middleware/auth.middleware");
const { createOrder, verifyPayment } = require("../controllers/payment.controller");

const router = express.Router();

router.post("/orders", protect, createOrder);
router.post("/verify", protect, verifyPayment);

module.exports = router;
