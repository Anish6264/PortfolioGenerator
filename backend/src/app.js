const express = require("express");
const cors = require("cors");
const createRateLimiter = require("./middleware/rateLimit.middleware");

const authRoutes = require("./routes/auth.routes");
const templateRoutes = require("./routes/template.routes");
const portfolioRoutes = require("./routes/portfolio.routes");
const generatorRoutes = require("./routes/generator.routes");
const uploadRoutes = require("./routes/upload.routes");
const publicPortfolioRoutes = require("./routes/publicPortfolio.routes");
const importRoutes = require("./routes/import.routes");
const aiContentRoutes = require("./routes/aiContent.routes");
const adminRoutes = require("./routes/admin.routes");
const paymentRoutes = require("./routes/payment.routes");
const creditTransactionRoutes = require("./routes/creditTransaction.routes");

const app = express();

app.disable("x-powered-by");

const parseProxyHops = () => {
    const raw = process.env.TRUST_PROXY_HOPS;
    if (raw === undefined || raw === "") return false;
    if (!/^\d+$/.test(raw) || Number(raw) > 5) {
        throw new Error("TRUST_PROXY_HOPS must be an integer between 0 and 5");
    }
    return Number(raw);
};

app.set("trust proxy", parseProxyHops());

const configuredOrigins = (process.env.FRONTEND_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
if (process.env.NODE_ENV === "production" && configuredOrigins.length === 0) {
    throw new Error("FRONTEND_ORIGINS must be configured in production");
}
for (const origin of configuredOrigins) {
    let parsedOrigin;
    try { parsedOrigin = new URL(origin); } catch { throw new Error("FRONTEND_ORIGINS contains an invalid origin"); }
    if (!["http:", "https:"].includes(parsedOrigin.protocol) || parsedOrigin.origin !== origin || parsedOrigin.username || parsedOrigin.password) {
        throw new Error("FRONTEND_ORIGINS must contain only exact HTTP or HTTPS origins");
    }
}
const allowedOrigins = new Set(configuredOrigins.length
    ? configuredOrigins
    : ["http://localhost:5173", "http://127.0.0.1:5173"]);

app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("X-Frame-Options", "DENY");
    res.set("Referrer-Policy", "no-referrer");
    res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.set("Cache-Control", "no-store");
    if (process.env.NODE_ENV === "production" && req.secure) {
        res.set("Strict-Transport-Security", "max-age=31536000");
    }
    const origin = req.get("Origin");
    if (origin && !allowedOrigins.has(origin)) {
        return res.status(403).json({ message: "Origin not allowed" });
    }
    return next();
});

app.use(cors({
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: false,
    optionsSuccessStatus: 204
}));
app.use(express.json({ limit: "256kb" }));

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
app.use("/api/payments", paymentRoutes);
app.use("/api/credit-transactions", creditTransactionRoutes);

app.use((req, res) => res.status(404).json({ message: "Endpoint not found" }));

app.use((error, req, res, next) => {
    if (error.type === "entity.parse.failed") {
        return res.status(400).json({ message: "Invalid JSON request body" });
    }
    if (error.type === "entity.too.large") {
        return res.status(413).json({ message: "Request body is too large" });
    }
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
    if (typeof error.code === "string" && error.code.startsWith("LIMIT_")) {
        return res.status(400).json({ message: "Upload request exceeds the allowed limits" });
    }

    console.error("Unhandled request error:", error?.name || "REQUEST_ERROR", error?.code || "UNHANDLED");
    return res.status(500).json({
        message: "Server error"
    });
});

module.exports = app;
