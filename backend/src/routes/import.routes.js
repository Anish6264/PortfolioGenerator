const express = require("express");
const protect = require("../middleware/auth.middleware");
const upload = require("../middleware/upload.middleware");
const { importResume, importGitHub } = require("../controllers/import.controller");

const router = express.Router();

router.post("/resume", protect, upload.single("resume"), importResume);
router.post("/github", protect, importGitHub);

module.exports = router;
