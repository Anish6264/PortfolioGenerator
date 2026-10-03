require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");
const {
    refundExpiredGitHubReservations,
    refundExpiredPortfolioDownloadReservations
} = require("./services/creditReservation.service");

const PORT = process.env.PORT || 5000;

if (typeof process.env.JWT_SECRET !== "string" || process.env.JWT_SECRET.length === 0) {
    throw new Error("JWT_SECRET must be configured");
}
if (typeof process.env.MONGO_URI !== "string" || !process.env.MONGO_URI.trim()) {
    throw new Error("MONGO_URI must be configured");
}

const cleanExpiredCreditReservations = async () => {
    try {
        const githubRefunded = await refundExpiredGitHubReservations();
        const downloadRefunded = await refundExpiredPortfolioDownloadReservations();
        const refunded = githubRefunded + downloadRefunded;
        if (refunded) console.log(`Refunded ${refunded} expired credit reservation(s)`);
    } catch {
        console.error("Expired credit reservation cleanup failed");
    }
};

connectDB().then(() => {
    void cleanExpiredCreditReservations();
    const cleanupTimer = setInterval(() => void cleanExpiredCreditReservations(), 5 * 60 * 1000);
    cleanupTimer.unref();

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
