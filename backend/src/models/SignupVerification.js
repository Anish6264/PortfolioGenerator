const mongoose = require("mongoose");

const signupVerificationSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    otpHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    resendAfter: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    verifiedAt: { type: Date, default: null },
    verificationTokenHash: { type: String, default: null, select: false },
    authorizationExpiresAt: { type: Date, default: null },
    consumedAt: { type: Date, default: null }
}, { timestamps: true });

signupVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("SignupVerification", signupVerificationSchema);
