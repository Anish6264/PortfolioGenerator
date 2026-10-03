const PortfolioAnalytics = require("../models/PortfolioAnalytics");

const recordEvent = (portfolioId, event) => {
    try {
        void Promise.resolve(PortfolioAnalytics.create({ portfolio: portfolioId, event })).catch((error) => {
            console.error("Portfolio analytics recording failed:", error?.name || "ANALYTICS_WRITE_ERROR", error?.code || "UNKNOWN");
        });
    } catch (error) {
        console.error("Portfolio analytics recording failed:", error?.name || "ANALYTICS_WRITE_ERROR", error?.code || "UNKNOWN");
    }
};

module.exports = { recordEvent };
