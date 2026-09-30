require("dotenv").config();

const mongoose = require("mongoose");
const Template = require("../models/Template");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB connected");
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    }
};

const seedTemplates = async () => {
    try {
        await connectDB();

        const templates = [
            {
                name: "Modern Developer",
                description: "A clean and modern portfolio template for software developers.",
                thumbnail: "",
                previewUrl: "",
                category: "developer",
                templatePath: "modern-developer",
                isPremium: false,
                creditCost: 0,
                isActive: true
            },
            {
                name: "Minimal Developer",
                description: "A quiet, typography-led portfolio with focused project summaries.",
                thumbnail: "",
                previewUrl: "",
                category: "developer",
                templatePath: "minimal-developer",
                isPremium: false,
                creditCost: 0,
                isActive: true
            },
            {
                name: "Professional Developer",
                description: "A structured CV-style portfolio centered on experience and case studies.",
                thumbnail: "",
                previewUrl: "",
                category: "developer",
                templatePath: "professional-developer",
                isPremium: false,
                creditCost: 0,
                isActive: true
            },
            {
                name: "ML Engineer",
                description: "A research and systems portfolio for machine learning and AI engineers.",
                thumbnail: "",
                previewUrl: "",
                category: "ml-engineer",
                templatePath: "ml-engineer",
                isPremium: false,
                creditCost: 0,
                isActive: true
            },
            {
                name: "Data Scientist",
                description: "An analytical portfolio for data science, modeling, and insight work.",
                thumbnail: "",
                previewUrl: "",
                category: "data-scientist",
                templatePath: "data-scientist",
                isPremium: false,
                creditCost: 0,
                isActive: true
            },
            {
                name: "Creative Designer",
                description: "An editorial portfolio for product designers and creative practitioners.",
                thumbnail: "",
                previewUrl: "",
                category: "ui-ux",
                templatePath: "ui-ux",
                isPremium: false,
                creditCost: 0,
                isActive: true
            },
            {
                name: "Cybersecurity / DevOps",
                description: "A technical operations portfolio for security and infrastructure work.",
                thumbnail: "",
                previewUrl: "",
                category: "cybersecurity",
                templatePath: "cybersecurity-devops",
                isPremium: false,
                creditCost: 0,
                isActive: true
            }
        ];

        for (const template of templates) {
            await Template.findOneAndUpdate(
                { templatePath: template.templatePath },
                { $set: template },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        }

        console.log("Templates seeded successfully");

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error("Template seed error:", error.message);

        await mongoose.connection.close();
        process.exit(1);
    }
};

seedTemplates();
