const CreditTransaction = require("../models/CreditTransaction");
const User = require("../models/User");

const validTypes = new Set(["PURCHASE", "DOWNLOAD", "GITHUB_IMPORT", "REFUND"]);

const requireTransactionSession = (session) => {
    if (!session || !session.inTransaction()) {
        throw new TypeError("Credit mutations require an active MongoDB transaction");
    }
};

const mutateCreditsAndRecord = async ({
    userId,
    direction,
    type,
    amount,
    reason,
    referenceId,
    session,
    portfolioId = null,
    templateId = null,
    paymentTransactionId = null,
    metadata
}) => {
    requireTransactionSession(session);
    if (!validTypes.has(type) || !["CREDIT", "DEBIT"].includes(direction)) {
        throw new TypeError("Invalid credit transaction type or direction");
    }
    if (!Number.isSafeInteger(amount) || amount < 1) {
        throw new TypeError("Credit transaction amount must be a positive integer");
    }
    if (typeof reason !== "string" || !reason.trim() || reason.length > 180) {
        throw new TypeError("Credit transaction reason is required");
    }
    if (typeof referenceId !== "string" || !referenceId || referenceId.length > 200) {
        throw new TypeError("Credit transaction reference is required");
    }

    const existing = await CreditTransaction.findOne({ user: userId, type, referenceId })
        .session(session)
        .lean();
    if (existing) return { duplicate: true, transaction: existing };

    const delta = direction === "CREDIT" ? amount : -amount;
    const filter = direction === "DEBIT"
        ? { _id: userId, credits: { $gte: amount, $mod: [1, 0] } }
        : { _id: userId };
    const user = await User.findOneAndUpdate(
        filter,
        { $inc: { credits: delta } },
        { returnDocument: "after", session }
    ).select("credits");

    if (!user || !Number.isSafeInteger(user.credits) || user.credits < 0) return null;

    const balanceAfter = user.credits;
    const balanceBefore = balanceAfter - delta;
    const [transaction] = await CreditTransaction.create(
        [{
            user: userId,
            type,
            direction,
            amount,
            balanceBefore,
            balanceAfter,
            reason: reason.trim(),
            portfolio: portfolioId,
            template: templateId,
            paymentTransaction: paymentTransactionId,
            referenceId,
            status: "COMPLETED",
            ...(metadata ? { metadata } : {})
        }],
        { session }
    );

    return { duplicate: false, user, transaction, balanceBefore, balanceAfter };
};

const recordCreditPurchase = (options) => mutateCreditsAndRecord({
    ...options,
    type: "PURCHASE",
    direction: "CREDIT"
});

const recordCreditDebit = (options) => mutateCreditsAndRecord({
    ...options,
    direction: "DEBIT"
});

const recordCreditRefund = async ({
    userId,
    amount,
    reason,
    referenceId,
    originalType,
    session,
    portfolioId = null,
    templateId = null
}) => {
    const refund = await mutateCreditsAndRecord({
        userId,
        direction: "CREDIT",
        type: "REFUND",
        amount,
        reason,
        referenceId,
        session,
        portfolioId,
        templateId
    });
    if (refund && !refund.duplicate && originalType) {
        await CreditTransaction.updateOne(
            { user: userId, type: originalType, direction: "DEBIT", referenceId, status: "COMPLETED" },
            { $set: { status: "REFUNDED" } },
            { session }
        );
    }
    return refund;
};

module.exports = {
    recordCreditPurchase,
    recordCreditDebit,
    recordCreditRefund
};
