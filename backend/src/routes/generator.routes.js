const express = require("express");

const protect = require("../middleware/auth.middleware");
const createRateLimiter = require("../middleware/rateLimit.middleware");

const {
    generatePortfolioZip,
    previewPortfolio
} = require("../controllers/generator.controller");

const router = express.Router();
const limitPortfolioGeneration = createRateLimiter({ name: "portfolio-generation", windowMs: 15 * 60 * 1000, max: 15, byUser: true });
const limitPortfolioPreview = createRateLimiter({ name: "portfolio-preview", windowMs: 15 * 60 * 1000, max: 60, byUser: true });

router.post(
    "/:portfolioId",
    protect,
    limitPortfolioGeneration,
    generatePortfolioZip
);

router.get(
    "/:portfolioId/preview",
    protect,
    limitPortfolioPreview,
    previewPortfolio
);

module.exports = router;
