const {
    normalizeEmail,
    safeSecretMatches,
    createAdminVerificationToken
} = require("../utils/adminVerification");

const verifyAdminAccess = (req, res) => {
    const designatedEmail = normalizeEmail(process.env.ADMIN_EMAIL);
    const userEmail = normalizeEmail(req.adminUser?.email);
    const accessCode = process.env.ADMIN_ACCESS_CODE;

    if (!designatedEmail || !accessCode || !userEmail || userEmail !== designatedEmail) {
        return res.status(403).json({ message: "Admin verification is unavailable for this account" });
    }
    if (!safeSecretMatches(req.body?.password, accessCode)) {
        return res.status(401).json({ code: "INVALID_ADMIN_ACCESS", message: "Incorrect admin access password" });
    }

    try {
        const verificationToken = createAdminVerificationToken({ userId: req.user.id, email: userEmail });
        const decoded = JSON.parse(Buffer.from(verificationToken.split(".")[1], "base64url").toString("utf8"));
        return res.status(200).json({
            verificationToken,
            expiresAt: new Date(decoded.exp * 1000).toISOString()
        });
    } catch {
        return res.status(503).json({ message: "Admin verification is temporarily unavailable" });
    }
};

module.exports = { verifyAdminAccess };
