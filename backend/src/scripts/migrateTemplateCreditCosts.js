require("dotenv").config();

const mongoose = require("mongoose");
const Template = require("../models/Template");

const migrateTemplateCreditCosts = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const result = await Template.updateMany(
            {
                $or: [
                    { creditCost: { $exists: false } },
                    { creditCost: { $lt: 1 } }
                ]
            },
            { $set: { creditCost: 1 } },
            { runValidators: true }
        );
        console.log(`Updated ${result.modifiedCount} template credit cost(s) to the minimum.`);
    } catch (error) {
        console.error("Template credit-cost migration failed:", error?.name || "MIGRATION_ERROR", error?.code || "UNKNOWN");
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
};

void migrateTemplateCreditCosts();
