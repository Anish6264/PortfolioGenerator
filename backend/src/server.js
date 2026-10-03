require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");
const {
    refundExpiredGitHubReservations,
    refundExpiredPortfolioDownloadReservations
} = require("./services/creditReservation.service");

const PORT = process.env.PORT || 5000;

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
