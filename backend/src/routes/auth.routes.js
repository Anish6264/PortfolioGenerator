const express = require("express");

const {
    registerUser,
    loginUser,
    getCurrentUser,
    updateProfile
} = require("../controllers/auth.controller");
const protect = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", protect, getCurrentUser);
router.put("/profile", protect, updateProfile);

module.exports = router;
