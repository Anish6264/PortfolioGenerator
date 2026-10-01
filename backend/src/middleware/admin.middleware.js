const User = require("../models/User");

const requireAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.user?.id).select("role");

        if (!user) {
            return res.status(401).json({ message: "Not authorized" });
        }

        if (user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        return next();
    } catch (error) {
        if (error.name === "CastError") {
            return res.status(401).json({ message: "Not authorized" });
        }

        console.error("Admin authorization lookup failed");
        return res.status(500).json({ message: "Server error" });
    }
};

module.exports = requireAdmin;
