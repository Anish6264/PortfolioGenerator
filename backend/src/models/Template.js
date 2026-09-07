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
            trim: true
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
            default: 0
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