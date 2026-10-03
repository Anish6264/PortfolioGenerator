const express = require("express");
const protect = require("../middleware/auth.middleware");
const createRateLimiter = require("../middleware/rateLimit.middleware");
const { createOrder, verifyPayment } = require("../controllers/payment.controller");

const router = express.Router();
const limitPaymentOrders = createRateLimiter({ name: "payment-orders", windowMs: 15 * 60 * 1000, max: 10, byUser: true });
const limitPaymentVerification = createRateLimiter({ name: "payment-verification", windowMs: 15 * 60 * 1000, max: 20, byUser: true });

router.post("/orders", protect, limitPaymentOrders, createOrder);
router.post("/verify", protect, limitPaymentVerification, verifyPayment);

module.exports = router;
