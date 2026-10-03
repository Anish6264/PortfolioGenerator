const express = require("express");
const protect = require("../middleware/auth.middleware");
const upload = require("../middleware/upload.middleware");
const {
    importResume,
    importGitHub,
    analyzeResume,
    commitGitHubReservation,
    refundGitHubReservation
} = require("../controllers/import.controller");

const router = express.Router();

router.post("/resume", protect, upload.single("resume"), importResume);
router.post("/resume/analyze", protect, analyzeResume);
router.post("/github", protect, importGitHub);
router.post("/github/reservations/:reservationId/commit", protect, commitGitHubReservation);
router.post("/github/reservations/:reservationId/refund", protect, refundGitHubReservation);

module.exports = router;
