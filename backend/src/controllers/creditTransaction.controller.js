const CreditTransaction = require("../models/CreditTransaction");

const allowedQuery = new Set(["page", "limit", "type", "direction", "status", "startDate", "endDate"]);
const types = new Set(["PURCHASE", "DOWNLOAD", "GITHUB_IMPORT", "REFUND"]);
const statuses = new Set(["COMPLETED", "REFUNDED", "FAILED"]);

const listCreditTransactions = async (req, res) => {
    const queryKeys = Object.keys(req.query || {});
    if (queryKeys.some((key) => !allowedQuery.has(key))) {
        return res.status(400).json({ code: "INVALID_FILTER", message: "Unsupported transaction filter" });
    }
    const { page: rawPage = "1", limit: rawLimit = "20", type, direction, status, startDate, endDate } = req.query;
    const page = Number(rawPage);
    const limit = Number(rawLimit);
    if (!/^\d+$/.test(String(rawPage)) || !Number.isSafeInteger(page) || page < 1 ||
        !/^\d+$/.test(String(rawLimit)) || !Number.isSafeInteger(limit) || limit < 1 || limit > 50 ||
        !Number.isSafeInteger((page - 1) * limit) ||
        (type && !types.has(type)) ||
        (direction && !["CREDIT", "DEBIT"].includes(direction)) ||
        (status && !statuses.has(status))) {
        return res.status(400).json({ code: "INVALID_FILTER", message: "Invalid transaction filter" });
    }
    const dateFilter = {};
    if (startDate) {
        const date = new Date(startDate);
        if (!Number.isFinite(date.getTime())) return res.status(400).json({ code: "INVALID_FILTER", message: "Invalid transaction date filter" });
        dateFilter.$gte = date;
    }
    if (endDate) {
        const date = new Date(endDate);
        if (!Number.isFinite(date.getTime())) return res.status(400).json({ code: "INVALID_FILTER", message: "Invalid transaction date filter" });
        dateFilter.$lte = date;
    }
    if (dateFilter.$gte && dateFilter.$lte && dateFilter.$gte > dateFilter.$lte) {
        return res.status(400).json({ code: "INVALID_FILTER", message: "Start date must be before end date" });
    }

    try {
        const filter = { user: req.user.id };
        if (type) filter.type = type;
        if (direction) filter.direction = direction;
        if (status) filter.status = status;
        if (Object.keys(dateFilter).length) filter.createdAt = dateFilter;
        const [rows, total] = await Promise.all([
            CreditTransaction.find(filter).sort({ createdAt: -1, _id: -1 })
                .skip((page - 1) * limit).limit(limit)
                .populate("portfolio", "personal.name personal.title")
                .populate("template", "name")
                .populate("paymentTransaction", "razorpayOrderId status currency createdAt")
                .lean(),
            CreditTransaction.countDocuments(filter)
        ]);
        return res.json({
            transactions: rows.map((row) => ({
                id: String(row._id),
                type: row.type,
                direction: row.direction,
                amount: row.amount,
                balanceBefore: row.balanceBefore,
                balanceAfter: row.balanceAfter,
                reason: row.reason,
                status: row.status,
                createdAt: row.createdAt,
                portfolio: row.portfolio ? {
                    id: String(row.portfolio._id),
                    name: row.portfolio.personal?.name || row.portfolio.personal?.title || "Portfolio"
                } : null,
                template: row.template ? { id: String(row.template._id), name: row.template.name } : null,
                payment: row.paymentTransaction ? {
                    orderId: row.paymentTransaction.razorpayOrderId,
                    status: row.paymentTransaction.status,
                    currency: row.paymentTransaction.currency,
                    createdAt: row.paymentTransaction.createdAt
                } : null
            })),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("List credit transactions error:", error?.name || "CREDIT_TRANSACTION_LIST_ERROR", error?.code || "UNKNOWN");
        return res.status(500).json({ code: "TRANSACTIONS_UNAVAILABLE", message: "Unable to load credit transactions" });
    }
};

module.exports = { listCreditTransactions };
