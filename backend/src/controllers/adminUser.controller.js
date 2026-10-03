const mongoose = require("mongoose");
const User = require("../models/User");
const Portfolio = require("../models/Portfolio");
const CreditTransaction = require("../models/CreditTransaction");
const PaymentTransaction = require("../models/PaymentTransaction");
const CREDIT_PACKS = require("../config/creditPacks");

const allowedListQuery = new Set(["page", "limit", "search", "role"]);
const PAGE_SIZE_MAX = 50;
const RECENT_LIMIT = 10;

const escapeRegex = (value) => {
    const special = ".*+?^" + String.fromCharCode(36) + "{}()|[]\\";
    return Array.from(value).map((character) => special.includes(character) ? "\\" + character : character).join("");
};

const listAdminUsers = async (req, res) => {
    const query = req.query || {};
    if (Object.keys(query).some((key) => !allowedListQuery.has(key))) {
        return res.status(400).json({ message: "Unsupported user filter" });
    }

    const rawPage = query.page === undefined ? "1" : query.page;
    const rawLimit = query.limit === undefined ? "20" : query.limit;
    const page = Number(rawPage);
    const limit = Number(rawLimit);
    const search = typeof query.search === "string" ? query.search.trim() : "";
    const role = query.role === undefined || query.role === "all" ? "" : query.role;
    if (
        typeof rawPage !== "string" || !/^\d+$/.test(rawPage) || !Number.isSafeInteger(page) || page < 1 ||
        typeof rawLimit !== "string" || !/^\d+$/.test(rawLimit) || !Number.isSafeInteger(limit) || limit < 1 || limit > PAGE_SIZE_MAX ||
        !Number.isSafeInteger((page - 1) * limit) ||
        (query.search !== undefined && typeof query.search !== "string") ||
        search.length > 100 ||
        (role && !["admin", "user"].includes(role))
    ) {
        return res.status(400).json({ message: "Invalid user filter" });
    }

    const filter = {};
    if (role) filter.role = role;
    if (search) {
        const expression = new RegExp(escapeRegex(search), "i");
        filter.$or = [{ name: expression }, { email: expression }];
    }

    try {
        const [users, total] = await Promise.all([
            User.find(filter)
                .select("name email role credits createdAt updatedAt")
                .sort({ createdAt: -1, _id: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            User.countDocuments(filter)
        ]);

        const userIds = users.map((user) => user._id);
        const counts = userIds.length
            ? await Portfolio.aggregate([
                { $match: { user: { $in: userIds } } },
                { $group: { _id: "$user", count: { $sum: 1 } } }
            ])
            : [];
        const portfolioCountByUser = new Map(counts.map((entry) => [String(entry._id), entry.count]));

        return res.status(200).json({
            users: users.map((user) => ({
                _id: String(user._id),
                name: user.name,
                email: user.email,
                role: user.role,
                credits: user.credits,
                portfolioCount: portfolioCountByUser.get(String(user._id)) || 0,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            })),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error("Admin user list query failed:", error.name || "ADMIN_USER_LIST_ERROR");
        return res.status(500).json({ message: "Unable to load users" });
    }
};

const getAdminUserDetails = async (req, res) => {
    const { id } = req.params;
    if (!/^[a-f\d]{24}$/i.test(id || "") || !mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
    }

    try {
        const user = await User.findById(id)
            .select("name email role credits avatar createdAt updatedAt")
            .lean();
        if (!user) return res.status(404).json({ message: "User not found" });

        const [portfolioCount, portfolios, creditTransactions, payments] = await Promise.all([
            Portfolio.countDocuments({ user: user._id }),
            Portfolio.find({ user: user._id })
                .select("personal.name personal.title template status slug createdAt updatedAt")
                .populate("template", "name category isPremium")
                .sort({ createdAt: -1, _id: -1 }).limit(RECENT_LIMIT).lean(),
            CreditTransaction.find({ user: user._id })
                .select("type direction amount balanceBefore balanceAfter reason status createdAt")
                .sort({ createdAt: -1, _id: -1 }).limit(RECENT_LIMIT).lean(),
            PaymentTransaction.find({ user: user._id })
                .select("razorpayOrderId razorpayPaymentId amount currency credits status createdAt")
                .sort({ createdAt: -1, _id: -1 }).limit(RECENT_LIMIT).lean()
        ]);

        return res.status(200).json({
            user: {
                id: String(user._id),
                name: user.name,
                email: user.email,
                role: user.role,
                credits: user.credits,
                avatar: user.avatar || "",
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            },
            portfolioCount,
            portfolios: portfolios.map((portfolio) => ({
                id: String(portfolio._id),
                name: portfolio.personal?.name || "",
                title: portfolio.personal?.title || "",
                template: portfolio.template ? {
                    id: String(portfolio.template._id),
                    name: portfolio.template.name,
                    category: portfolio.template.category,
                    isPremium: portfolio.template.isPremium
                } : null,
                status: portfolio.status,
                slug: portfolio.slug || null,
                createdAt: portfolio.createdAt,
                updatedAt: portfolio.updatedAt
            })),
            creditTransactions: creditTransactions.map((entry) => ({
                id: String(entry._id),
                type: entry.type,
                direction: entry.direction,
                amount: entry.amount,
                balanceBefore: entry.balanceBefore,
                balanceAfter: entry.balanceAfter,
                reason: entry.reason,
                status: entry.status,
                createdAt: entry.createdAt
            })),
            payments: payments.map((payment) => ({
                id: String(payment._id),
                orderId: payment.razorpayOrderId,
                paymentId: payment.razorpayPaymentId,
                pack: Object.entries(CREDIT_PACKS).find(([, pack]) =>
                    pack.amount === payment.amount &&
                    pack.currency === payment.currency &&
                    pack.credits === payment.credits
                )?.[0] || null,
                credits: payment.credits,
                amount: payment.amount,
                currency: payment.currency,
                status: payment.status,
                createdAt: payment.createdAt
            })),
            recentLimit: RECENT_LIMIT
        });
    } catch (error) {
        console.error("Admin user details query failed:", error.name || "ADMIN_USER_DETAILS_ERROR");
        return res.status(500).json({ message: "Unable to load user details" });
    }
};

module.exports = { listAdminUsers, getAdminUserDetails };
