const mongoose = require("mongoose");
const User = require("../models/User");
const CreditTransaction = require("../models/CreditTransaction");

const PAGE_SIZE_MAX = 50;
const PAGE_SIZE_DEFAULT = 20;
const allowedQuery = new Set(["page", "limit", "type", "direction", "status", "search"]);
const types = CreditTransaction.schema.path("type").enumValues;
const directions = CreditTransaction.schema.path("direction").enumValues;
const statuses = CreditTransaction.schema.path("status").enumValues;

const escapeRegex = (value) => {
    const special = ".*+?^" + String.fromCharCode(36) + "{}()|[]\\";
    return Array.from(value).map((character) => special.includes(character) ? "\\" + character : character).join("");
};

const serializeTransaction = (transaction) => ({
    id: String(transaction._id),
    user: transaction.user ? {
        id: String(transaction.user._id),
        name: transaction.user.name,
        email: transaction.user.email
    } : null,
    type: transaction.type,
    direction: transaction.direction,
    amount: transaction.amount,
    balanceBefore: transaction.balanceBefore,
    balanceAfter: transaction.balanceAfter,
    reason: transaction.reason,
    portfolio: transaction.portfolio ? {
        id: String(transaction.portfolio._id),
        name: transaction.portfolio.personal?.name || "",
        title: transaction.portfolio.personal?.title || "",
        status: transaction.portfolio.status
    } : null,
    template: transaction.template ? {
        id: String(transaction.template._id),
        name: transaction.template.name,
        category: transaction.template.category
    } : null,
    payment: transaction.paymentTransaction ? {
        id: String(transaction.paymentTransaction._id),
        orderId: transaction.paymentTransaction.razorpayOrderId,
        paymentId: transaction.paymentTransaction.razorpayPaymentId || null,
        amount: transaction.paymentTransaction.amount,
        currency: transaction.paymentTransaction.currency,
        status: transaction.paymentTransaction.status
    } : null,
    referenceId: transaction.referenceId || null,
    status: transaction.status,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt
});

const populateSafeReferences = (query) => query
    .populate("user", "name email")
    .populate("portfolio", "personal.name personal.title status")
    .populate("template", "name category")
    .populate("paymentTransaction", "razorpayOrderId razorpayPaymentId amount currency status");

const listAdminCreditTransactions = async (req, res) => {
    const query = req.query || {};
    if (Object.keys(query).some((key) => !allowedQuery.has(key))) {
        return res.status(400).json({ message: "Unsupported credit transaction filter" });
    }

    const rawPage = query.page === undefined ? "1" : query.page;
    const rawLimit = query.limit === undefined ? String(PAGE_SIZE_DEFAULT) : query.limit;
    const page = Number(rawPage);
    const limit = Number(rawLimit);
    const type = query.type === undefined || query.type === "all" ? "" : query.type;
    const direction = query.direction === undefined || query.direction === "all" ? "" : query.direction;
    const status = query.status === undefined || query.status === "all" ? "" : query.status;
    const search = typeof query.search === "string" ? query.search.trim() : "";

    if (
        typeof rawPage !== "string" || !/^\d+$/.test(rawPage) || !Number.isSafeInteger(page) || page < 1 ||
        typeof rawLimit !== "string" || !/^\d+$/.test(rawLimit) || !Number.isSafeInteger(limit) || limit < 1 || limit > PAGE_SIZE_MAX ||
        !Number.isSafeInteger((page - 1) * limit) ||
        (query.type !== undefined && typeof query.type !== "string") || (type && !types.includes(type)) ||
        (query.direction !== undefined && typeof query.direction !== "string") || (direction && !directions.includes(direction)) ||
        (query.status !== undefined && typeof query.status !== "string") || (status && !statuses.includes(status)) ||
        (query.search !== undefined && typeof query.search !== "string") || search.length > 100
    ) {
        return res.status(400).json({ message: "Invalid credit transaction filter" });
    }

    const filter = {};
    if (type) filter.type = type;
    if (direction) filter.direction = direction;
    if (status) filter.status = status;

    try {
        if (search) {
            const expression = new RegExp(escapeRegex(search), "i");
            const matchingUserIds = await User.find({ $or: [{ name: expression }, { email: expression }] }).distinct("_id");
            const searchConditions = [{ reason: expression }, { referenceId: expression }];
            if (matchingUserIds.length) searchConditions.push({ user: { $in: matchingUserIds } });
            filter.$or = searchConditions;
        }

        const selected = "user type direction amount balanceBefore balanceAfter reason portfolio template paymentTransaction referenceId status createdAt updatedAt";
        const [transactions, total] = await Promise.all([
            populateSafeReferences(CreditTransaction.find(filter).select(selected))
                .sort({ createdAt: -1, _id: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            CreditTransaction.countDocuments(filter)
        ]);

        return res.status(200).json({
            transactions: transactions.map(serializeTransaction),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            filters: { types, directions, statuses }
        });
    } catch (error) {
        console.error("Admin credit transaction list failed:", error.name || "ADMIN_CREDIT_TRANSACTION_LIST_ERROR");
        return res.status(500).json({ message: "Unable to load credit transactions" });
    }
};

const getAdminCreditTransactionDetails = async (req, res) => {
    const { id } = req.params;
    if (!/^[a-f\d]{24}$/i.test(id || "") || !mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Invalid credit transaction ID" });
    }
    try {
        const selected = "user type direction amount balanceBefore balanceAfter reason portfolio template paymentTransaction referenceId status createdAt updatedAt";
        const transaction = await populateSafeReferences(CreditTransaction.findById(id).select(selected)).lean();
        if (!transaction) return res.status(404).json({ message: "Credit transaction not found" });
        return res.status(200).json({ transaction: serializeTransaction(transaction) });
    } catch (error) {
        console.error("Admin credit transaction details failed:", error.name || "ADMIN_CREDIT_TRANSACTION_DETAILS_ERROR");
        return res.status(500).json({ message: "Unable to load credit transaction" });
    }
};

module.exports = { listAdminCreditTransactions, getAdminCreditTransactionDetails };
