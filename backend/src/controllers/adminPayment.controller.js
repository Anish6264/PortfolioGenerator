const mongoose = require("mongoose");
const User = require("../models/User");
const PaymentTransaction = require("../models/PaymentTransaction");
const CreditTransaction = require("../models/CreditTransaction");

const allowedQuery = new Set(["page", "limit", "status", "currency", "search"]);
const PAGE_SIZE_MAX = 50;
const PAGE_SIZE_DEFAULT = 20;
const paymentStatuses = PaymentTransaction.schema.path("status").enumValues;
const currencies = PaymentTransaction.schema.path("currency").enumValues;

const escapeRegex = (value) => {
    const special = ".*+?^" + String.fromCharCode(36) + "{}()|[]\\";
    return Array.from(value).map((character) => special.includes(character) ? "\\" + character : character).join("");
};

const serializePayment = (payment) => ({
    id: String(payment._id),
    user: payment.user ? {
        id: String(payment.user._id),
        name: payment.user.name,
        email: payment.user.email
    } : null,
    credits: payment.credits,
    amount: payment.amount,
    currency: payment.currency,
    orderId: payment.razorpayOrderId,
    paymentId: payment.razorpayPaymentId || null,
    status: payment.status,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt
});

const listAdminPayments = async (req, res) => {
    const query = req.query || {};
    if (Object.keys(query).some((key) => !allowedQuery.has(key))) {
        return res.status(400).json({ message: "Unsupported payment filter" });
    }
    const rawPage = query.page === undefined ? "1" : query.page;
    const rawLimit = query.limit === undefined ? String(PAGE_SIZE_DEFAULT) : query.limit;
    const page = Number(rawPage);
    const limit = Number(rawLimit);
    const status = query.status === undefined || query.status === "all" ? "" : query.status;
    const currency = query.currency === undefined || query.currency === "all" ? "" : query.currency;
    const search = typeof query.search === "string" ? query.search.trim() : "";
    if (
        typeof rawPage !== "string" || !/^\d+$/.test(rawPage) || !Number.isSafeInteger(page) || page < 1 ||
        typeof rawLimit !== "string" || !/^\d+$/.test(rawLimit) || !Number.isSafeInteger(limit) || limit < 1 || limit > PAGE_SIZE_MAX ||
        !Number.isSafeInteger((page - 1) * limit) ||
        (query.status !== undefined && typeof query.status !== "string") ||
        (status && !paymentStatuses.includes(status)) ||
        (query.currency !== undefined && typeof query.currency !== "string") ||
        (currency && !currencies.includes(currency)) ||
        (query.search !== undefined && typeof query.search !== "string") ||
        search.length > 100
    ) {
        return res.status(400).json({ message: "Invalid payment filter" });
    }

    const filter = {};
    if (status) filter.status = status;
    if (currency) filter.currency = currency;
    try {
        if (search) {
            const expression = new RegExp(escapeRegex(search), "i");
            const matchingUserIds = await User.find({
                $or: [{ name: expression }, { email: expression }]
            }).distinct("_id");
            const searchConditions = [
                { razorpayOrderId: expression },
                { razorpayPaymentId: expression }
            ];
            if (matchingUserIds.length) searchConditions.push({ user: { $in: matchingUserIds } });
            filter.$or = searchConditions;
        }

        const [payments, total] = await Promise.all([
            PaymentTransaction.find(filter)
                .select("user razorpayOrderId razorpayPaymentId amount currency credits status createdAt updatedAt")
                .populate("user", "name email")
                .sort({ createdAt: -1, _id: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            PaymentTransaction.countDocuments(filter)
        ]);
        return res.status(200).json({
            payments: payments.map(serializePayment),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            filters: { statuses: paymentStatuses, currencies }
        });
    } catch (error) {
        console.error("Admin payment list query failed:", error.name || "ADMIN_PAYMENT_LIST_ERROR");
        return res.status(500).json({ message: "Unable to load payments" });
    }
};

const getAdminPaymentDetails = async (req, res) => {
    const { id } = req.params;
    if (!/^[a-f\d]{24}$/i.test(id || "") || !mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Invalid payment ID" });
    }
    try {
        const payment = await PaymentTransaction.findById(id)
            .select("user razorpayOrderId razorpayPaymentId amount currency credits status verification createdAt updatedAt")
            .populate("user", "name email")
            .lean();
        if (!payment) return res.status(404).json({ message: "Payment not found" });

        const fulfillment = await CreditTransaction.findOne({
            paymentTransaction: payment._id,
            type: "PURCHASE",
            direction: "CREDIT",
            status: "COMPLETED"
        }).select("amount balanceBefore balanceAfter createdAt").lean();

        return res.status(200).json({
            payment: {
                ...serializePayment(payment),
                verification: payment.verification ? {
                    verifiedAt: payment.verification.verifiedAt || null,
                    paymentStatus: payment.verification.paymentStatus || null
                } : null
            },
            creditFulfillment: fulfillment ? {
                credits: fulfillment.amount,
                balanceBefore: fulfillment.balanceBefore,
                balanceAfter: fulfillment.balanceAfter,
                createdAt: fulfillment.createdAt
            } : null
        });
    } catch (error) {
        console.error("Admin payment details query failed:", error.name || "ADMIN_PAYMENT_DETAILS_ERROR");
        return res.status(500).json({ message: "Unable to load payment details" });
    }
};

module.exports = { listAdminPayments, getAdminPaymentDetails };
