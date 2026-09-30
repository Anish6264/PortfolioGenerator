const express = require("express");
const protect = require("../middleware/auth.middleware");
const { requestGeneratedContent } = require("../controllers/aiContent.controller");

const router = express.Router();

router.post("/content", protect, requestGeneratedContent);

module.exports = router;
