const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const normalizeEmail = (email) => typeof email === "string" ? email.trim().toLowerCase() : "";

const getSigningSecret = () => {
    if (!process.env.JWT_SECRET) throw new Error("JWT signing is not configured");
    return crypto.createHmac("sha256", process.env.JWT_SECRET)
        .update("portfolio-generator:admin-verification:v1")
        .digest();
};

const createAdminVerificationToken = ({ userId, email, expiresIn = "15m" }) => jwt.sign({
    id: String(userId),
    email: normalizeEmail(email),
    type: "admin_verification"
}, getSigningSecret(), { algorithm: "HS256", expiresIn });

const verifyAdminVerificationToken = (token, { userId, email }) => {
    try {
        const decoded = jwt.verify(token, getSigningSecret(), { algorithms: ["HS256"] });
        return decoded?.type === "admin_verification" &&
            decoded.id === String(userId) &&
            decoded.email === normalizeEmail(email);
    } catch {
        return false;
    }
};

const safeSecretMatches = (provided, expected) => {
    if (typeof provided !== "string" || typeof expected !== "string" || !expected) return false;
    const providedDigest = crypto.createHash("sha256").update(provided, "utf8").digest();
    const expectedDigest = crypto.createHash("sha256").update(expected, "utf8").digest();
    return crypto.timingSafeEqual(providedDigest, expectedDigest);
};

module.exports = {
    normalizeEmail,
    createAdminVerificationToken,
    verifyAdminVerificationToken,
    safeSecretMatches
};
