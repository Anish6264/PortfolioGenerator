const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User.js");
const SignupVerification = require("../models/SignupVerification");
const { isValidPassword } = require("../utils/passwordValidation");
const { sendEmail } = require("../utils/sendEmail");

const normalizeEmail = (value) => typeof value === "string" ? value.trim().toLowerCase() : "";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
const SIGNUP_AUTH_TTL_MS = 15 * 60 * 1000;

const requestSignupOtp = async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Enter a valid email address" });
    }

    try {
        if (await User.findOne({ email })) {
            return res.status(409).json({ message: "An account with this email already exists" });
        }
        const previous = await SignupVerification.findOne({ email });
        if (previous?.resendAfter && previous.resendAfter > new Date()) {
            return res.status(429).json({ message: "Please wait before requesting another code" });
        }

        const otp = String(crypto.randomInt(100000, 1000000));
        const now = new Date();
        const verification = await SignupVerification.findOneAndUpdate(
            { email },
            { $set: {
                otpHash: sha256(otp), expiresAt: new Date(now.getTime() + OTP_TTL_MS),
                resendAfter: new Date(now.getTime() + OTP_RESEND_MS), attempts: 0,
                verifiedAt: null, verificationTokenHash: null, authorizationExpiresAt: null, consumedAt: null
            } },
            { upsert: true, new: true, runValidators: true }
        );
        try {
            await sendEmail({
                to: email,
                subject: "Verify your Portfolio Generator email",
                heading: "Verify your email",
                message: "Use this one-time code to finish creating your Portfolio Generator account.",
                detail: `${otp} · Expires in 5 minutes`
            });
        } catch (error) {
            await SignupVerification.deleteOne({ _id: verification._id });
            console.error("Signup email delivery failed:", error?.name || "EMAIL_ERROR");
            return res.status(503).json({ message: "Unable to send a verification email right now" });
        }
        return res.status(200).json({ message: "Verification code sent" });
    } catch (error) {
        console.error("Signup OTP request failed:", error?.name || "OTP_REQUEST_ERROR");
        return res.status(500).json({ message: "Unable to request a verification code right now" });
    }
};

const verifySignupOtp = async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
    if (!email || !/^\d{6}$/.test(otp)) return res.status(400).json({ message: "Enter the six-digit code" });

    try {
        const verification = await SignupVerification.findOne({ email }).select("+otpHash +verificationTokenHash");
        const now = new Date();
        if (!verification || verification.consumedAt || verification.verifiedAt || verification.expiresAt <= now) {
            return res.status(400).json({ message: "Code is invalid or expired. Request a new code." });
        }
        if (verification.attempts >= 5) return res.status(429).json({ message: "Too many incorrect attempts. Request a new code." });

        const submittedHash = Buffer.from(sha256(otp), "hex");
        const storedHash = Buffer.from(verification.otpHash, "hex");
        const matches = submittedHash.length === storedHash.length && crypto.timingSafeEqual(submittedHash, storedHash);
        if (!matches) {
            verification.attempts += 1;
            await verification.save();
            return res.status(400).json({ message: verification.attempts >= 5 ? "Too many incorrect attempts. Request a new code." : "Incorrect verification code" });
        }

        const registrationToken = crypto.randomBytes(32).toString("hex");
        verification.verifiedAt = now;
        verification.verificationTokenHash = sha256(registrationToken);
        verification.authorizationExpiresAt = new Date(now.getTime() + SIGNUP_AUTH_TTL_MS);
        verification.expiresAt = verification.authorizationExpiresAt;
        await verification.save();
        return res.status(200).json({ message: "Email verified", registrationToken });
    } catch (error) {
        console.error("Signup OTP verification failed:", error?.name || "OTP_VERIFY_ERROR");
        return res.status(500).json({ message: "Unable to verify this code right now" });
    }
};

const registerUser = async (req, res) => {
    try {
        const { name: submittedName, email: submittedEmail, password, registrationToken } = req.body || {};
        const name = typeof submittedName === "string" ? submittedName.trim() : "";
        const email = typeof submittedEmail === "string"
            ? submittedEmail.trim().toLowerCase()
            : "";

        // Check required fields
        if (!name || !email || typeof password !== "string" || !password) {
            return res.status(400).json({
                message: "Name, email and password are required"
            });
        }

        if (
            name.length > 100 ||
            !/^[\p{L}\p{M}][\p{L}\p{M}\p{Zs}'\u2019-]*$/u.test(name) ||
            email.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            return res.status(400).json({ message: "Enter a valid name and email address" });
        }

        if (!isValidPassword(password)) {
            return res.status(400).json({ message: "Password must be at least 8 characters, include uppercase, lowercase, a number and a special character, and use no more than 72 UTF-8 bytes" });
        }
        if (typeof registrationToken !== "string" || !/^[a-f0-9]{64}$/.test(registrationToken)) {
            return res.status(403).json({ message: "Verify your email before creating an account" });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(409).json({
                message: "User with this email already exists"
            });
        }

        const authorization = await SignupVerification.findOneAndUpdate(
            { email, verificationTokenHash: sha256(registrationToken), verifiedAt: { $ne: null }, authorizationExpiresAt: { $gt: new Date() }, consumedAt: null },
            { $set: { consumedAt: new Date() } },
            { new: true }
        );
        if (!authorization) return res.status(403).json({ message: "Email verification is missing or expired. Verify your email again." });

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            credits: 10
        });

        return res.status(201).json({
            message: "User registered successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                credits: user.credits
            }
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: "User with this email already exists" });
        }
        console.error("Registration error:", error?.name || "REGISTRATION_ERROR", error?.code || "UNKNOWN");

        return res.status(500).json({
            message: "Server error"
        });
    }
};

const forgotPassword = async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Enter a valid email address" });
    }
    const genericMessage = "If an account exists for that email, a password reset link has been sent";
    const frontendUrl = process.env.FRONTEND_URL || process.env.FRONTEND_ORIGINS?.split(",")[0]?.trim();
    let resetBaseUrl;
    try {
        const parsed = new URL(frontendUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Invalid frontend URL");
        resetBaseUrl = parsed;
    } catch {
        console.error("Password reset frontend URL is not configured");
        return res.status(503).json({ message: "Password reset email is temporarily unavailable. Please try again later." });
    }
    try {
        const user = await User.findOne({ email });
        if (user) {
            const token = crypto.randomBytes(32).toString("hex");
            const resetUrl = new URL(`/reset-password/${token}`, resetBaseUrl).toString();
            user.resetPasswordToken = sha256(token);
            user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
            await user.save();
            try {
                await sendEmail({
                    to: email,
                    subject: "Reset your Portfolio Generator password",
                    heading: "Reset your password",
                    message: "Use the link below within 15 minutes to choose a new password.",
                    actionUrl: resetUrl
                });
            } catch (error) {
                user.resetPasswordToken = undefined;
                user.resetPasswordExpires = undefined;
                await user.save();
                console.error("Password reset email delivery failed:", error?.name || "EMAIL_ERROR");
                return res.status(503).json({ message: "Password reset email could not be sent. Please try again later." });
            }
        }
        return res.status(200).json({ message: genericMessage });
    } catch (error) {
        console.error("Password reset request failed:", error?.name || "PASSWORD_RESET_REQUEST_ERROR");
        return res.status(500).json({ message: "Unable to process the password reset request right now" });
    }
};

const resetPassword = async (req, res) => {
    const token = typeof req.params?.token === "string" ? req.params.token : "";
    const password = req.body?.password;
    if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ message: "Reset link is invalid or expired" });
    if (!isValidPassword(password)) return res.status(400).json({ message: "Password must be at least 8 characters, include uppercase, lowercase, a number and a special character, and use no more than 72 UTF-8 bytes" });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const updated = await User.findOneAndUpdate(
            { resetPasswordToken: sha256(token), resetPasswordExpires: { $gt: new Date() } },
            { $set: { password: hashedPassword }, $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 } },
            { new: true, runValidators: true }
        );
        if (!updated) return res.status(400).json({ message: "Reset link is invalid or expired" });
        return res.status(200).json({ message: "Password reset successfully. You can now log in." });
    } catch (error) {
        console.error("Password reset failed:", error?.name || "PASSWORD_RESET_ERROR");
        return res.status(500).json({ message: "Unable to reset your password right now" });
    }
};

const loginUser = async (req, res) => {
    try {
        const { email: submittedEmail, password } = req.body || {};
        const email = typeof submittedEmail === "string"
            ? submittedEmail.trim().toLowerCase()
            : "";

        // Check required fields
        if (!email || email.length > 254 || typeof password !== "string" || !password || Buffer.byteLength(password, "utf8") > 1024) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        // Find user
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        // Compare password
        const isPasswordCorrect = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordCorrect) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        // Create JWT
        const token = jwt.sign(
            {
                id: user._id
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                role: user.role,
                credits: user.credits
            }
        });
    } catch (error) {
        console.error("Login error:", error?.name || "LOGIN_ERROR", error?.code || "UNKNOWN");

        return res.status(500).json({
            message: "Server error"
        });
    }
};

const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.status(200).json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                role: user.role,
                credits: user.credits
            }
        });
    } catch (error) {
        console.error("Get current user error:", error?.name || "CURRENT_USER_ERROR", error?.code || "UNKNOWN");

        return res.status(500).json({
            message: "Server error"
        });
    }
};

const updateProfile = async (req, res) => {
    const body = req.body || {};
    const updates = {};
    const allowedFields = new Set(["name", "email", "avatar"]);

    if (Object.keys(body).some((field) => !allowedFields.has(field))) {
        return res.status(400).json({ message: "Unsupported profile field" });
    }

    if (Object.prototype.hasOwnProperty.call(body, "name")) {
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (
            !name ||
            name.length > 100 ||
            !/^[\p{L}\p{M}][\p{L}\p{M}\p{Zs}'\u2019-]*$/u.test(name)
        ) {
            return res.status(400).json({ message: "Enter a valid name of 100 characters or fewer" });
        }
        updates.name = name;
    }

    if (Object.prototype.hasOwnProperty.call(body, "email")) {
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: "Enter a valid email address" });
        }
        updates.email = email;
    }

    if (Object.prototype.hasOwnProperty.call(body, "avatar")) {
        const avatar = typeof body.avatar === "string" ? body.avatar.trim() : null;
        if (avatar === null || avatar.length > 2048) {
            return res.status(400).json({ message: "Avatar must be a valid HTTP or HTTPS URL" });
        }
        if (avatar) {
            let safeUrl = false;
            try {
                const parsed = new URL(avatar);
                safeUrl = ["http:", "https:"].includes(parsed.protocol) && Boolean(parsed.hostname);
            } catch {
                safeUrl = false;
            }
            if (!safeUrl) {
                return res.status(400).json({ message: "Avatar must be a valid HTTP or HTTPS URL" });
            }
        }
        updates.avatar = avatar;
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "Provide at least one profile field to update" });
    }

    try {
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: updates },
            { returnDocument: "after", runValidators: true, select: "name email avatar role credits" }
        );

        if (!user) return res.status(404).json({ message: "User not found" });

        return res.status(200).json({
            message: "Profile updated successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                role: user.role,
                credits: user.credits
            }
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: "An account with this email already exists" });
        }
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ message: "Invalid profile information" });
        }
        console.error("Update profile error:", error?.name || "PROFILE_UPDATE_ERROR", error?.code || "UNKNOWN");
        return res.status(500).json({ message: "Server error" });
    }
};

const changePassword = async (req, res) => {
    const body = req.body || {};
    if (Object.keys(body).some((field) => !["currentPassword", "newPassword"].includes(field))) {
        return res.status(400).json({ message: "Unsupported password change field" });
    }

    const { currentPassword, newPassword } = body;
    if (
        typeof currentPassword !== "string" ||
        !currentPassword ||
        Buffer.byteLength(currentPassword, "utf8") > 1024 ||
        typeof newPassword !== "string" ||
        newPassword.length < 6 ||
        newPassword.length > 128 ||
        Buffer.byteLength(newPassword, "utf8") > 72
    ) {
        return res.status(400).json({ message: "Enter your current password and a new password of at least 6 characters and no more than 72 UTF-8 bytes" });
    }

    try {
        const user = await User.findById(req.user.id).select("+password");
        if (!user) {
            return res.status(401).json({ message: "Unable to change password for this account" });
        }

        const currentMatches = await bcrypt.compare(currentPassword, user.password);
        if (!currentMatches) {
            return res.status(400).json({ message: "Current password is incorrect" });
        }

        const samePassword = await bcrypt.compare(newPassword, user.password);
        if (samePassword) {
            return res.status(400).json({ message: "New password must be different from your current password" });
        }

        const password = await bcrypt.hash(newPassword, 10);
        const updateResult = await User.updateOne({ _id: req.user.id }, { $set: { password } });
        if (updateResult.matchedCount !== 1) {
            return res.status(401).json({ message: "Unable to change password for this account" });
        }
        return res.status(200).json({ message: "Password changed successfully" });
    } catch (error) {
        console.error("Change password error:", error.name || "PASSWORD_CHANGE_ERROR");
        return res.status(500).json({ message: "Unable to change password right now" });
    }
};

module.exports = {
    requestSignupOtp,
    verifySignupOtp,
    registerUser,
    forgotPassword,
    resetPassword,
    loginUser,
    getCurrentUser,
    updateProfile,
    changePassword
};
