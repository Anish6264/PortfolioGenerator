const express = require("express");
const protect = require("../middleware/auth.middleware");
const { listCreditTransactions } = require("../controllers/creditTransaction.controller");

const router = express.Router();
router.get("/", protect, listCreditTransactions);

module.exports = router;
