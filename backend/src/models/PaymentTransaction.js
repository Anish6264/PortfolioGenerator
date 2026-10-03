const mongoose = require("mongoose");

const paymentTransactionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        razorpayOrderId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        razorpayPaymentId: {
            type: String,
            default: null,
            index: true
        },
        amount: {
            type: Number,
            required: true,
            min: 1
        },
        currency: {
            type: String,
            required: true,
            enum: ["INR"],
            default: "INR"
        },
        credits: {
            type: Number,
            required: true,
            min: 1,
            validate: Number.isInteger
        },
        status: {
            type: String,
            required: true,
            enum: ["pending", "paid", "failed", "refunded"],
            default: "pending",
            index: true
        },
        verification: {
            verifiedAt: { type: Date, default: null },
            paymentStatus: { type: String, default: null }
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("PaymentTransaction", paymentTransactionSchema);
