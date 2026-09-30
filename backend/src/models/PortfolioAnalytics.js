const mongoose = require("mongoose");

const portfolioAnalyticsSchema = new mongoose.Schema(
    {
        portfolio: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Portfolio",
            required: true,
            index: true
        },
        event: {
            type: String,
            enum: ["view", "resume-click", "project-click"],
            required: true
        }
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model("PortfolioAnalytics", portfolioAnalyticsSchema);
