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

        await Template.deleteMany({});

        await Template.create({
            name: "Modern Developer",
            description: "A clean and modern portfolio template for software developers.",
            thumbnail: "",
            previewUrl: "",
            category: "developer",
            templatePath: "modern-developer",
            isPremium: false,
            creditCost: 0,
            isActive: true
        });

        console.log("Template added successfully");

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error("Template seed error:", error.message);

        await mongoose.connection.close();
        process.exit(1);
    }
};

seedTemplates();