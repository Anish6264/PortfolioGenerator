const jwt = require("jsonwebtoken");

const protect = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (typeof authHeader !== "string" || !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authHeader)) {
            return res.status(401).json({
                message: "Not authorized"
            });
        }

        const decoded = jwt.verify(
            authHeader.slice(7),
            process.env.JWT_SECRET,
            { algorithms: ["HS256"] }
        );

        if (typeof decoded?.id !== "string" || !/^[a-f\d]{24}$/i.test(decoded.id)) {
            return res.status(401).json({ message: "Invalid or expired token" });
        }

        req.user = { id: decoded.id };

        next();
    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
};

module.exports = protect;
