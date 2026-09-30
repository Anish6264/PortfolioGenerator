const express = require("express");

const protect = require("../middleware/auth.middleware");

const {
    createPortfolio,
    getMyPortfolios,
    getPortfolioById,
    updatePortfolio,
    duplicatePortfolio,
    updatePortfolioStatus,
    deletePortfolio
} = require("../controllers/portfolio.controller");
const { getPortfolioAnalytics } = require("../controllers/portfolioAnalytics.controller");

const router = express.Router();

router.post("/", protect, createPortfolio);

router.get("/", protect, getMyPortfolios);

router.post("/:id/duplicate", protect, duplicatePortfolio);

router.patch("/:id/status", protect, updatePortfolioStatus);

router.get("/:id/analytics", protect, getPortfolioAnalytics);

router.get("/:id", protect, getPortfolioById);

router.put("/:id", protect, updatePortfolio);

router.delete("/:id", protect, deletePortfolio);

module.exports = router;
