const mongoose = require("mongoose");

const portfolioSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        template: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Template",
            required: true
        },

        personal: {
            name: {
                type: String,
                required: true,
                trim: true
            },

            title: {
                type: String,
                required: true,
                trim: true
            },

            email: {
                type: String,
                required: true,
                trim: true
            },

            phone: {
                type: String,
                default: ""
            },

            location: {
                type: String,
                default: ""
            },

            profileImage: {
                type: String,
                default: ""
            }
        },

        shortIntro: {
            type: String,
            default: ""
        },

        about: {
            type: String,
            default: ""
        },

        skills: [
            {
                type: String,
                trim: true
            }
        ],

        education: [
            {
                degree: String,
                institution: String,
                startYear: String,
                endYear: String,
                description: String
            }
        ],

        experience: [
            {
                company: String,
                role: String,
                startDate: String,
                endDate: String,
                description: String
            }
        ],

        projects: [
            {
                title: String,
                description: String,
                technologies: [String],
                liveUrl: String,
                githubUrl: String
            }
        ],

        social: {
            github: {
                type: String,
                default: ""
            },

            linkedin: {
                type: String,
                default: ""
            },

            twitter: {
                type: String,
                default: ""
            }
        }
    },
    {
        timestamps: true
    }
);

const Portfolio = mongoose.model("Portfolio", portfolioSchema);

module.exports = Portfolio;