const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const templateRoutes = require("./routes/template.routes");
const portfolioRoutes = require("./routes/portfolio.routes");
const generatorRoutes = require("./routes/generator.routes");
const uploadRoutes = require("./routes/upload.routes");
const publicPortfolioRoutes = require("./routes/publicPortfolio.routes");
const importRoutes = require("./routes/import.routes");
const aiContentRoutes = require("./routes/aiContent.routes");
const adminRoutes = require("./routes/admin.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "Portfolio Generator API is running"
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/portfolios", portfolioRoutes);
app.use("/api/public/portfolios", publicPortfolioRoutes);
app.use("/api/import", importRoutes);
app.use("/api/ai", aiContentRoutes);
app.use("/api/generator", generatorRoutes);
app.use("/api/uploads", uploadRoutes);

app.use((error, req, res, next) => {
    if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
            message: "Files must be 5 MB or smaller"
        });
    }

    if (
        error.code === "INVALID_FILE_TYPE" ||
        error.code === "LIMIT_UNEXPECTED_FILE"
    ) {
        return res.status(400).json({
            message: "Unsupported file type or upload field"
        });
    }

    console.error("Unhandled request error:", error);
    return res.status(500).json({
        message: "Server error"
    });
});

module.exports = app;
