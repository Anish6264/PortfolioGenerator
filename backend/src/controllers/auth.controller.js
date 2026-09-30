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

        // Check password length
        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters"
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
            credits: 5
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
        console.error("Registration error:", error);

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
        if (!email || typeof password !== "string" || !password) {
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
        console.error("Login error:", error);

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
        console.error("Get current user error:", error);

        return res.status(500).json({
            message: "Server error"
        });
    }
};

const updateProfile = async (req, res) => {
    const body = req.body || {};
    const updates = {};

    if (Object.prototype.hasOwnProperty.call(body, "name")) {
        if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100) {
            return res.status(400).json({ message: "Name is required and must be 100 characters or fewer" });
        }
        updates.name = body.name.trim();
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
            { new: true, runValidators: true, select: "name email avatar credits" }
        );

        if (!user) return res.status(404).json({ message: "User not found" });

        return res.status(200).json({
            message: "Profile updated successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
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
        console.error("Update profile error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getCurrentUser,
    updateProfile
};
