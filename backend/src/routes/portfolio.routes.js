const express = require("express");

const protect = require("../middleware/auth.middleware");

const {
    createPortfolio,
    getMyPortfolios,
    getPortfolioById,
    updatePortfolio,
    deletePortfolio
} = require("../controllers/portfolio.controller");

const router = express.Router();

router.post("/", protect, createPortfolio);

router.get("/", protect, getMyPortfolios);

router.get("/:id", protect, getPortfolioById);

router.put("/:id", protect, updatePortfolio);

router.delete("/:id", protect, deletePortfolio);

module.exports = router;