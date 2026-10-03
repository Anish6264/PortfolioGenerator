const mongoose = require("mongoose");

const creditReservationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        portfolio: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Portfolio",
            default: null,
            index: true
        },
        template: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Template",
            default: null
        },
        contentVersion: {
            type: Number,
            default: null,
            min: 1,
            validate: (value) => value === null || Number.isInteger(value)
        },
        operation: {
            type: String,
            required: true,
            enum: ["github_project_import", "portfolio_generation"]
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
            enum: ["reserved", "committed", "refunded"],
            default: "reserved"
        },
        completedAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("CreditReservation", creditReservationSchema);
