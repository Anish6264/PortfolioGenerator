const express = require("express");
const protect = require("../middleware/auth.middleware");
const createRateLimiter = require("../middleware/rateLimit.middleware");
const upload = require("../middleware/upload.middleware");
const {
    importResume,
    importGitHub,
    analyzeResume,
    commitGitHubReservation,
    refundGitHubReservation
} = require("../controllers/import.controller");

const router = express.Router();
const limitResumeUpload = createRateLimiter({ name: "resume-upload", windowMs: 15 * 60 * 1000, max: 5, byUser: true });
const limitResumeAnalysis = createRateLimiter({ name: "resume-analysis", windowMs: 15 * 60 * 1000, max: 5, byUser: true });
const limitGitHubImport = createRateLimiter({ name: "github-import", windowMs: 15 * 60 * 1000, max: 5, byUser: true });
const limitGitHubReservation = createRateLimiter({ name: "github-reservation", windowMs: 15 * 60 * 1000, max: 30, byUser: true });

router.post("/resume", protect, limitResumeUpload, upload.single("resume"), importResume);
router.post("/resume/analyze", protect, limitResumeAnalysis, analyzeResume);
router.post("/github", protect, limitGitHubImport, importGitHub);
router.post("/github/reservations/:reservationId/commit", protect, limitGitHubReservation, commitGitHubReservation);
router.post("/github/reservations/:reservationId/refund", protect, limitGitHubReservation, refundGitHubReservation);

module.exports = router;
