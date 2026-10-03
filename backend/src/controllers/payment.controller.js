const Razorpay = require("razorpay");
const crypto = require("crypto");
const mongoose = require("mongoose");
const PaymentTransaction = require("../models/PaymentTransaction");
const User = require("../models/User");
const CREDIT_PACKS = require("../config/creditPacks");

let razorpayClient;

const getRazorpayClient = () => {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        const error = new Error("Payment service is not configured");
        error.status = 503;
        throw error;
    }

    if (!razorpayClient) {
        razorpayClient = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });
    }

    return razorpayClient;
};

const verifyPayment = async (req, res) => {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};

    if (
        typeof orderId !== "string" || !orderId || orderId.length > 100 ||
        typeof paymentId !== "string" || !paymentId || paymentId.length > 100 ||
        typeof signature !== "string" || !/^[a-f\d]{64}$/i.test(signature)
    ) {
        return res.status(400).json({ code: "INVALID_PAYMENT_DETAILS", message: "Invalid payment verification details" });
    }

    try {
        const razorpay = getRazorpayClient();
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${orderId}|${paymentId}`)
            .digest("hex");
        const expectedBuffer = Buffer.from(expectedSignature, "hex");
        const suppliedBuffer = Buffer.from(signature, "hex");

        if (expectedBuffer.length !== suppliedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
            return res.status(400).json({ code: "PAYMENT_VERIFICATION_FAILED", message: "Payment verification failed" });
        }

        const transaction = await PaymentTransaction.findOne({
            razorpayOrderId: orderId,
            user: req.user.id
        });

        if (!transaction) {
            return res.status(404).json({ code: "PAYMENT_ORDER_NOT_FOUND", message: "Payment order not found" });
        }

        if (transaction.status === "paid") {
            if (transaction.razorpayPaymentId === paymentId) {
                return res.status(200).json({ status: "paid", credits: transaction.credits, alreadyVerified: true });
            }
            return res.status(409).json({ code: "PAYMENT_ALREADY_PROCESSED", message: "Payment order has already been processed" });
        }

        if (transaction.status !== "pending") {
            return res.status(409).json({ code: "PAYMENT_NOT_PENDING", message: "Payment order is not pending" });
        }

        const matchingPack = Object.values(CREDIT_PACKS).find((pack) =>
            pack.amount === transaction.amount &&
            pack.currency === transaction.currency &&
            pack.credits === transaction.credits
        );
        if (!matchingPack) {
            return res.status(409).json({ code: "PAYMENT_TRANSACTION_INVALID", message: "Payment order cannot be verified" });
        }

        const [remoteOrder, payment] = await Promise.all([
            razorpay.orders.fetch(orderId),
            razorpay.payments.fetch(paymentId)
        ]);

        if (
            remoteOrder.id !== transaction.razorpayOrderId ||
            remoteOrder.amount !== transaction.amount ||
            remoteOrder.currency !== transaction.currency ||
            payment.id !== paymentId ||
            payment.order_id !== transaction.razorpayOrderId ||
            payment.amount !== transaction.amount ||
            payment.currency !== transaction.currency
        ) {
            return res.status(400).json({ code: "PAYMENT_DETAILS_MISMATCH", message: "Payment details do not match the order" });
        }

        if (payment.status !== "captured") {
            return res.status(409).json({ code: "PAYMENT_NOT_CAPTURED", message: "Payment has not been captured" });
        }

        const session = await mongoose.startSession();
        let fulfilled = false;
        try {
            await session.withTransaction(async () => {
                const claimed = await PaymentTransaction.findOneAndUpdate(
                    { _id: transaction._id, user: req.user.id, status: "pending" },
                    {
                        $set: {
                            status: "paid",
                            razorpayPaymentId: paymentId,
                            verification: { verifiedAt: new Date(), paymentStatus: payment.status }
                        }
                    },
                    { returnDocument: "after", session }
                );

                if (!claimed) {
                    const current = await PaymentTransaction.findById(transaction._id).session(session);
                    if (current?.status === "paid" && current.razorpayPaymentId === paymentId) {
                        return;
                    }
                    throw Object.assign(new Error("Payment order is no longer pending"), { code: "PAYMENT_NOT_PENDING" });
                }

                const updatedUser = await User.updateOne(
                    { _id: req.user.id },
                    { $inc: { credits: matchingPack.credits } },
                    { session }
                );

                if (updatedUser.matchedCount !== 1) {
                    throw new Error("Payment user not found");
                }
                fulfilled = true;
            });
        } finally {
            await session.endSession();
        }

        if (!fulfilled) {
            return res.status(200).json({ status: "paid", credits: matchingPack.credits, alreadyVerified: true });
        }
        return res.status(200).json({ status: "paid", credits: matchingPack.credits, alreadyVerified: false });
    } catch (error) {
        if (error.code === "PAYMENT_NOT_PENDING") {
            return res.status(409).json({ code: error.code, message: "Payment order is no longer pending" });
        }
        // A concurrent request may win the transaction while this request is
        // handling a MongoDB write conflict. Treat the same payment as success.
        if (typeof orderId === "string" && typeof paymentId === "string") {
            try {
                const completed = await PaymentTransaction.findOne({
                    razorpayOrderId: orderId,
                    user: req.user.id,
                    status: "paid",
                    razorpayPaymentId: paymentId
                }).select("credits").lean();
                if (completed) {
                    return res.status(200).json({ status: "paid", credits: completed.credits, alreadyVerified: true });
                }
            } catch (lookupError) {
                // Keep the public response generic if the recovery lookup fails.
            }
        }
        console.error("Verify payment error:", error);
        return res.status(error.status === 503 ? 503 : 502).json({
            code: error.status === 503 ? "PAYMENT_SERVICE_UNAVAILABLE" : "PAYMENT_VERIFICATION_UNAVAILABLE",
            message: error.status === 503 ? "Payment service is not configured" : "Unable to verify payment"
        });
    }
};

const createOrder = async (req, res) => {
    const packId = req.body?.packId;
    const pack = typeof packId === "string" &&
        Object.prototype.hasOwnProperty.call(CREDIT_PACKS, packId)
        ? CREDIT_PACKS[packId]
        : null;

    if (!pack) {
        return res.status(400).json({ message: "Invalid credit pack" });
    }

    try {
        const razorpay = getRazorpayClient();
        const order = await razorpay.orders.create({
            amount: pack.amount,
            currency: pack.currency,
            receipt: `credits_${Date.now()}`
        });

        await PaymentTransaction.create({
            user: req.user.id,
            razorpayOrderId: order.id,
            amount: pack.amount,
            currency: pack.currency,
            credits: pack.credits,
            status: "pending"
        });

        return res.status(201).json({
            keyId: process.env.RAZORPAY_KEY_ID,
            orderId: order.id,
            amount: pack.amount,
            currency: pack.currency,
            pack: { id: packId, credits: pack.credits }
        });
    } catch (error) {
        console.error("Create payment order error:", error);
        return res.status(error.status || 502).json({
            message: error.status === 503 ? error.message : "Unable to create payment order"
        });
    }
};

module.exports = { createOrder, verifyPayment };
