const Portfolio = require("../models/Portfolio");

const createPortfolio = async (req, res) => {
    try {
        const portfolio = await Portfolio.create({
            ...req.body,
            user: req.user.id
        });

        return res.status(201).json({
            message: "Portfolio created successfully",
            portfolio
        });
    } catch (error) {
        console.error("Create portfolio error:", error.message);

        return res.status(500).json({
            message: "Server error"
        });
    }
};

const getMyPortfolios = async (req, res) => {
    try {
        const portfolios = await Portfolio.find({
            user: req.user.id
        }).populate("template", "name category");

        return res.status(200).json({
            portfolios
        });
    } catch (error) {
        console.error("Get portfolios error:", error.message);

        return res.status(500).json({
            message: "Server error"
        });
    }
};

const getPortfolioById = async (req, res) => {
    try {
        const portfolio = await Portfolio.findOne({
            _id: req.params.id,
            user: req.user.id
        }).populate("template");

        if (!portfolio) {
            return res.status(404).json({
                message: "Portfolio not found"
            });
        }

        return res.status(200).json({
            portfolio
        });
    } catch (error) {
        console.error("Get portfolio error:", error.message);

        return res.status(500).json({
            message: "Server error"
        });
    }
};

const updatePortfolio = async (req, res) => {
    try {
        const portfolio = await Portfolio.findOneAndUpdate(
            {
                _id: req.params.id,
                user: req.user.id
            },
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        if (!portfolio) {
            return res.status(404).json({
                message: "Portfolio not found"
            });
        }

        return res.status(200).json({
            message: "Portfolio updated successfully",
            portfolio
        });
    } catch (error) {
        console.error("Update portfolio error:", error.message);

        return res.status(500).json({
            message: "Server error"
        });
    }
};

const deletePortfolio = async (req, res) => {
    try {
        const portfolio = await Portfolio.findOneAndDelete({
            _id: req.params.id,
            user: req.user.id
        });

        if (!portfolio) {
            return res.status(404).json({
                message: "Portfolio not found"
            });
        }

        return res.status(200).json({
            message: "Portfolio deleted successfully"
        });
    } catch (error) {
        console.error("Delete portfolio error:", error.message);

        return res.status(500).json({
            message: "Server error"
        });
    }
};

module.exports = {
    createPortfolio,
    getMyPortfolios,
    getPortfolioById,
    updatePortfolio,
    deletePortfolio
};