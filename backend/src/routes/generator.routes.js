const express = require("express");

const protect = require("../middleware/auth.middleware");

const {
    generatePortfolioZip
} = require("../controllers/generator.controller");

const router = express.Router();

router.post("/:portfolioId", protect, generatePortfolioZip);

module.exports = router;