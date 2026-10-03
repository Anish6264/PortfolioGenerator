const mongoose = require("mongoose");

const creditTransactionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        type: {
            type: String,
            required: true,
            enum: ["PURCHASE", "DOWNLOAD", "GITHUB_IMPORT", "REFUND"]
        },
        direction: {
            type: String,
            required: true,
            enum: ["CREDIT", "DEBIT"]
        },
        amount: {
            type: Number,
            required: true,
            min: 1,
            validate: Number.isInteger
        },
        balanceBefore: {
            type: Number,
            required: true,
            min: 0,
            validate: Number.isInteger
        },
        balanceAfter: {
            type: Number,
            required: true,
            min: 0,
            validate: Number.isInteger
        },
        reason: {
            type: String,
            required: true,
            trim: true,
            maxlength: 180
        },
        portfolio: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Portfolio",
            default: null
        },
        template: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Template",
            default: null
        },
        paymentTransaction: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PaymentTransaction",
            default: null
        },
        referenceId: {
            type: String,
            trim: true,
            maxlength: 200,
            default: null
        },
        status: {
            type: String,
            enum: ["COMPLETED", "REFUNDED", "FAILED"],
            default: "COMPLETED",
            required: true
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: undefined
        }
    },
    { timestamps: true }
);

creditTransactionSchema.index({ user: 1, createdAt: -1 });
creditTransactionSchema.index({ user: 1, type: 1, createdAt: -1 });
creditTransactionSchema.index({ referenceId: 1 }, { sparse: true });
creditTransactionSchema.index(
    { user: 1, type: 1, referenceId: 1 },
    {
        unique: true,
        partialFilterExpression: { referenceId: { $type: "string" } }
    }
);

module.exports = mongoose.model("CreditTransaction", creditTransactionSchema);
