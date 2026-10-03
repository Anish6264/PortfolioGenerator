const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB connected successfully");

        try {
            const topology = await mongoose.connection.db.admin().command({ hello: 1 });
            const supportsTransactions = Boolean(topology.setName || topology.msg === "isdbgrid");

            if (supportsTransactions) {
                console.log("MongoDB topology supports transactions");
            } else {
                console.warn("MongoDB topology does not support transactions; payment fulfillment is unavailable");
            }
        } catch (error) {
            console.warn("MongoDB transaction support could not be determined");
        }
    } catch (error) {
        console.error("MongoDB connection failed:", error?.name || "MONGODB_CONNECTION_ERROR", error?.code || "UNKNOWN");
        process.exit(1);
    }
};

module.exports = connectDB;
