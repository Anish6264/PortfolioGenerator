const express = require("express");
const protect = require("../middleware/auth.middleware");
const { requestGeneratedContent, requestEnhancedContent } = require("../controllers/aiContent.controller");

const router = express.Router();

router.post("/content", protect, requestGeneratedContent);
router.post("/enhance", protect, requestEnhancedContent);

module.exports = router;
