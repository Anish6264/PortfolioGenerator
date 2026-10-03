const express = require("express");

const {
    registerUser,
    loginUser,
    getCurrentUser,
    updateProfile,
    changePassword
} = require("../controllers/auth.controller");
const protect = require("../middleware/auth.middleware");
const createRateLimiter = require("../middleware/rateLimit.middleware");

const router = express.Router();
const limitRegistration = createRateLimiter({ name: "register", windowMs: 15 * 60 * 1000, max: 10 });
const limitLogin = createRateLimiter({ name: "login", windowMs: 15 * 60 * 1000, max: 20 });
const limitPasswordChange = createRateLimiter({ name: "password-change", windowMs: 60 * 60 * 1000, max: 5, byUser: true });

router.post("/register", limitRegistration, registerUser);
router.post("/login", limitLogin, loginUser);
router.get("/me", protect, getCurrentUser);
router.put("/profile", protect, updateProfile);
router.patch("/change-password", protect, limitPasswordChange, changePassword);

module.exports = router;
