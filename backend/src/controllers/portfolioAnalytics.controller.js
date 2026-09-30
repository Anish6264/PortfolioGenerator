const Portfolio = require("../models/Portfolio");
const PortfolioAnalytics = require("../models/PortfolioAnalytics");

const isValidPortfolioId = (id) => /^[a-f\d]{24}$/i.test(id || "");

const getPortfolioAnalytics = async (req, res) => {
    if (!isValidPortfolioId(req.params.id)) {
        return res.status(400).json({ message: "Invalid portfolio ID" });
    }

    try {
        const range = req.query.range || "all";
        if (!["7d", "30d", "all"].includes(range)) return res.status(400).json({ message: "Invalid analytics date range" });
        const portfolio = await Portfolio.findOne({ _id: req.params.id, user: req.user.id }).select("_id");
        if (!portfolio) return res.status(404).json({ message: "Portfolio not found" });

        const match = { portfolio: portfolio._id };
        if (range !== "all") {
            const days = range === "7d" ? 7 : 30;
            match.createdAt = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
        }
        const counts = await PortfolioAnalytics.aggregate([
            { $match: match },
            { $group: { _id: "$event", count: { $sum: 1 } } }
        ]);
        const result = { views: 0, resumeClicks: 0, projectClicks: 0 };
        for (const count of counts) {
            if (count._id === "view") result.views = count.count;
            if (count._id === "resume-click") result.resumeClicks = count.count;
            if (count._id === "project-click") result.projectClicks = count.count;
        }
        return res.status(200).json({ ...result, range });
    } catch (error) {
        console.error("Get portfolio analytics error:", error);
        return res.status(500).json({ message: "Unable to load portfolio analytics" });
    }
};

module.exports = { getPortfolioAnalytics };
