const {
    normalizeEmail,
    verifyAdminVerificationToken
} = require("../utils/adminVerification");

const requireAdminVerification = (req, res, next) => {
    const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
    const userEmail = normalizeEmail(req.adminUser?.email);
    if (!adminEmail || !userEmail || userEmail !== adminEmail) {
        return res.status(403).json({
            code: "ADMIN_VERIFICATION_REQUIRED",
            message: "Admin verification is unavailable for this account"
        });
    }

    const token = req.get?.("X-Admin-Verification") || req.headers?.["x-admin-verification"];
    if (
        typeof token !== "string" ||
        !verifyAdminVerificationToken(token, { userId: req.user?.id, email: userEmail })
    ) {
        return res.status(403).json({
            code: "ADMIN_VERIFICATION_REQUIRED",
            message: "Verify admin access to continue"
        });
    }
    return next();
};

module.exports = requireAdminVerification;
