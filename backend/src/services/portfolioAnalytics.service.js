const PortfolioAnalytics = require("../models/PortfolioAnalytics");

const recordEvent = (portfolioId, event) => {
    try {
        void Promise.resolve(PortfolioAnalytics.create({ portfolio: portfolioId, event })).catch((error) => {
            console.error("Portfolio analytics recording failed:", error.message);
        });
    } catch (error) {
        console.error("Portfolio analytics recording failed:", error.message);
    }
};

module.exports = { recordEvent };
