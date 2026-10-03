const User = require("../models/User");
const Portfolio = require("../models/Portfolio");
const Template = require("../models/Template");
const PaymentTransaction = require("../models/PaymentTransaction");
const CreditTransaction = require("../models/CreditTransaction");

const RECENT_LIMIT = 5;

const getAdminDashboard = async (req, res) => {
    try {
        const [
            totalUsers, adminUsers, regularUsers, portfolioGroups, templateGroups,
            paymentSummary, creditGroups, recentUsers, recentPayments,
            recentCreditTransactions, recentPortfolios
        ] = await Promise.all([
            User.countDocuments({}),
            User.countDocuments({ role: "admin" }),
            User.countDocuments({ role: "user" }),
            Portfolio.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
            Template.aggregate([{
                $group: {
                    _id: {
                        active: { $ne: ["$isActive", false] },
                        premium: { $eq: ["$isPremium", true] }
                    },
                    count: { $sum: 1 }
                }
            }]),
            PaymentTransaction.aggregate([{
                $facet: {
                    statuses: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
                    revenue: [
                        { $match: { status: "paid" } },
                        { $group: { _id: "$currency", amountMinor: { $sum: "$amount" }, paymentCount: { $sum: 1 } } },
                        { $sort: { _id: 1 } }
                    ]
                }
            }]),
            CreditTransaction.aggregate([
                { $match: { status: "COMPLETED" } },
                { $group: { _id: { type: "$type", direction: "$direction" }, amount: { $sum: "$amount" }, count: { $sum: 1 } } }
            ]),
            User.find({}).select("name email createdAt").sort({ createdAt: -1, _id: -1 }).limit(RECENT_LIMIT).lean(),
            PaymentTransaction.find({})
                .select("razorpayOrderId amount currency status createdAt user")
                .populate("user", "name email").sort({ createdAt: -1, _id: -1 }).limit(RECENT_LIMIT).lean(),
            CreditTransaction.find({})
                .select("user type direction amount reason status createdAt")
                .populate("user", "name email").sort({ createdAt: -1, _id: -1 }).limit(RECENT_LIMIT).lean(),
            Portfolio.find({})
                .select("personal.name personal.title status user createdAt")
                .populate("user", "name email").sort({ createdAt: -1, _id: -1 }).limit(RECENT_LIMIT).lean()
        ]);

        const portfolioCounts = Object.fromEntries(portfolioGroups.map(({ _id, count }) => [_id, count]));
        const templateCounts = new Map(templateGroups.map(({ _id, count }) => [String(_id.active) + ":" + String(_id.premium), count]));
        const paymentStats = paymentSummary[0] || { statuses: [], revenue: [] };
        const paymentCounts = Object.fromEntries(paymentStats.statuses.map(({ _id, count }) => [_id, count]));
        const creditStats = (type, direction) =>
            creditGroups.find((entry) => entry._id.type === type && entry._id.direction === direction) || { amount: 0, count: 0 };
        const purchase = creditStats("PURCHASE", "CREDIT");
        const downloads = creditStats("DOWNLOAD", "DEBIT");
        const githubImports = creditStats("GITHUB_IMPORT", "DEBIT");
        const refunds = creditStats("REFUND", "CREDIT");

        return res.status(200).json({
            stats: {
                users: { total: totalUsers, admins: adminUsers, regular: regularUsers },
                portfolios: {
                    total: Object.values(portfolioCounts).reduce((sum, count) => sum + count, 0),
                    draft: portfolioCounts.draft || 0,
                    published: portfolioCounts.published || 0
                },
                templates: {
                    total: templateGroups.reduce((sum, group) => sum + group.count, 0),
                    active: (templateCounts.get("true:false") || 0) + (templateCounts.get("true:true") || 0),
                    inactive: (templateCounts.get("false:false") || 0) + (templateCounts.get("false:true") || 0),
                    premium: (templateCounts.get("true:true") || 0) + (templateCounts.get("false:true") || 0),
                    standard: (templateCounts.get("true:false") || 0) + (templateCounts.get("false:false") || 0)
                },
                payments: {
                    total: Object.values(paymentCounts).reduce((sum, count) => sum + count, 0),
                    paid: paymentCounts.paid || 0,
                    pending: paymentCounts.pending || 0,
                    failed: paymentCounts.failed || 0,
                    refunded: paymentCounts.refunded || 0,
                    successfulRevenue: paymentStats.revenue.map((entry) => ({
                        currency: entry._id,
                        amountMinor: entry.amountMinor,
                        paymentCount: entry.paymentCount
                    }))
                },
                credits: {
                    totalCreditsPurchased: purchase.amount,
                    purchaseTransactionCount: purchase.count,
                    totalCreditsSpent: downloads.amount + githubImports.amount,
                    downloadTransactionCount: downloads.count,
                    githubImportTransactionCount: githubImports.count,
                    totalCreditsRefunded: refunds.amount,
                    refundTransactionCount: refunds.count
                }
            },
            recent: {
                users: recentUsers.map((entry) => ({
                    id: String(entry._id), name: entry.name, email: entry.email, createdAt: entry.createdAt
                })),
                payments: recentPayments.map((entry) => ({
                    id: String(entry._id),
                    orderId: entry.razorpayOrderId,
                    amount: entry.amount,
                    currency: entry.currency,
                    status: entry.status,
                    createdAt: entry.createdAt,
                    user: entry.user ? { id: String(entry.user._id), name: entry.user.name, email: entry.user.email } : null
                })),
                creditTransactions: recentCreditTransactions.map((entry) => ({
                    id: String(entry._id),
                    type: entry.type,
                    direction: entry.direction,
                    amount: entry.amount,
                    reason: entry.reason,
                    status: entry.status,
                    createdAt: entry.createdAt,
                    user: entry.user ? { id: String(entry.user._id), name: entry.user.name, email: entry.user.email } : null
                })),
                portfolios: recentPortfolios.map((entry) => ({
                    id: String(entry._id),
                    name: entry.personal?.name || entry.personal?.title || "Portfolio",
                    status: entry.status,
                    createdAt: entry.createdAt,
                    user: entry.user ? { id: String(entry.user._id), name: entry.user.name, email: entry.user.email } : null
                }))
            },
            recentLimit: RECENT_LIMIT
        });
    } catch (error) {
        console.error("Admin dashboard query failed:", error.name || "ADMIN_DASHBOARD_ERROR");
        return res.status(500).json({ message: "Unable to load the admin dashboard" });
    }
};

module.exports = { getAdminDashboard };
