const express = require("express");

const protect = require("../middleware/auth.middleware");

const {
    generatePortfolioZip,
    previewPortfolio
} = require("../controllers/generator.controller");

const router = express.Router();

router.post(
    "/:portfolioId",
    protect,
    generatePortfolioZip
);

router.get(
    "/:portfolioId/preview",
    protect,
    previewPortfolio
);

module.exports = router;