const express = require("express");

const {
    registerUser,
    requestSignupOtp,
    verifySignupOtp,
    forgotPassword,
    resetPassword,
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
const limitSignupOtp = createRateLimiter({ name: "signup-otp", windowMs: 10 * 60 * 1000, max: 5 });
const limitSignupVerify = createRateLimiter({ name: "signup-verify", windowMs: 10 * 60 * 1000, max: 20 });
const limitForgotPassword = createRateLimiter({ name: "forgot-password", windowMs: 60 * 60 * 1000, max: 5 });
const limitResetPassword = createRateLimiter({ name: "reset-password", windowMs: 60 * 60 * 1000, max: 10 });
const limitPasswordChange = createRateLimiter({ name: "password-change", windowMs: 60 * 60 * 1000, max: 5, byUser: true });

router.post("/register", limitRegistration, registerUser);
router.post("/signup/otp", limitSignupOtp, requestSignupOtp);
router.post("/signup/verify-otp", limitSignupVerify, verifySignupOtp);
router.post("/forgot-password", limitForgotPassword, forgotPassword);
router.post("/reset-password/:token", limitResetPassword, resetPassword);
router.post("/login", limitLogin, loginUser);
router.get("/me", protect, getCurrentUser);
router.put("/profile", protect, updateProfile);
router.patch("/change-password", protect, limitPasswordChange, changePassword);

module.exports = router;
