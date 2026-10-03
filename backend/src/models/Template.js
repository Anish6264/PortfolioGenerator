const mongoose = require("mongoose");

const templateSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            required: true,
            trim: true
        },

        thumbnail: {
            type: String,
            default: ""
        },

        previewUrl: {
            type: String,
            default: ""
        },

        category: {
            type: String,
            required: true,
            trim: true,
            enum: [
                "developer",
                "ml-engineer",
                "data-scientist",
                "web-developer",
                "devops",
                "cybersecurity",
                "ui-ux",
                "product-manager",
                "company"
            ]
        },

        templatePath: {
            type: String,
            required: true,
            trim: true
        },

        isPremium: {
            type: Boolean,
            default: false
        },

        creditCost: {
            type: Number,
            default: 1,
            min: 1,
            validate: {
                validator(value) {
                    return Number.isInteger(value) && value >= 1;
                },
                message: "Template credit cost must be a positive integer"
            }
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

const Template = mongoose.model("Template", templateSchema);

module.exports = Template;
