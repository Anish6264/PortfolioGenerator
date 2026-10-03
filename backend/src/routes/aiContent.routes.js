const express = require("express");
const protect = require("../middleware/auth.middleware");
const createRateLimiter = require("../middleware/rateLimit.middleware");
const { requestGeneratedContent, requestEnhancedContent } = require("../controllers/aiContent.controller");

const router = express.Router();
const limitAIContent = createRateLimiter({ name: "ai-content", windowMs: 15 * 60 * 1000, max: 10, byUser: true });
const limitAIEnhance = createRateLimiter({ name: "ai-enhance", windowMs: 15 * 60 * 1000, max: 10, byUser: true });

router.post("/content", protect, limitAIContent, requestGeneratedContent);
router.post("/enhance", protect, limitAIEnhance, requestEnhancedContent);

module.exports = router;
