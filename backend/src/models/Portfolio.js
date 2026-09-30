const mongoose = require("mongoose");

const supportedSections = [
    "about",
    "education",
    "experience",
    "skills",
    "projects",
    "contact"
];

const colorPattern = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;

const customSectionSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 80
        },
        content: {
            type: String,
            required: true,
            trim: true,
            maxlength: 4000
        }
    },
    { _id: false }
);

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

        status: {
            type: String,
            enum: ["draft", "published"],
            default: "draft"
        },

        primaryColor: {
            type: String,
            default: "#111827",
            match: colorPattern
        },

        secondaryColor: {
            type: String,
            default: "#6b7280",
            match: colorPattern
        },

        backgroundColor: {
            type: String,
            default: "#ffffff",
            match: colorPattern
        },

        textColor: {
            type: String,
            default: "#1f2937",
            match: colorPattern
        },

        fontFamily: {
            type: String,
            enum: ["Arial", "Inter", "Poppins", "Roboto", "Open Sans", "Merriweather"],
            default: "Arial"
        },

        sectionVisibility: {
            about: { type: Boolean, default: true },
            education: { type: Boolean, default: true },
            experience: { type: Boolean, default: true },
            skills: { type: Boolean, default: true },
            projects: { type: Boolean, default: true },
            contact: { type: Boolean, default: true }
        },

        sectionOrder: {
            type: [{ type: String, enum: supportedSections }],
            default: []
        },

        customSections: {
            type: [customSectionSchema],
            default: []
        },

        seoTitle: {
            type: String,
            trim: true,
            maxlength: 70,
            default: ""
        },

        seoDescription: {
            type: String,
            trim: true,
            maxlength: 200,
            default: ""
        },

        resume: {
            type: String,
            default: ""
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
