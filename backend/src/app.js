const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const templateRoutes = require("./routes/template.routes");
const portfolioRoutes = require("./routes/portfolio.routes");
const generatorRoutes = require("./routes/generator.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "Portfolio Generator API is running"
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/portfolios", portfolioRoutes);
app.use("/api/generator", generatorRoutes);

module.exports = app;