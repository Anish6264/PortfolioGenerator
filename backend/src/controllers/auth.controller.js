const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User.js");

const registerUser = async (req, res) => {
    try {
        const { name: submittedName, email: submittedEmail, password } = req.body || {};
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

        if (password.length < 6 || Buffer.byteLength(password, "utf8") > 72) {
            return res.status(400).json({
                message: "Password must be at least 6 characters and no more than 72 UTF-8 bytes"
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(409).json({
                message: "User with this email already exists"
            });
        }

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
    registerUser,
    loginUser,
    getCurrentUser,
    updateProfile,
    changePassword
};
