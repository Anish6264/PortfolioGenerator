const express = require("express");
const {
    getPublicPortfolio,
    getPublicProfileImage,
    getPublicResume
} = require("../controllers/publicPortfolio.controller");

const router = express.Router();

router.get("/:slug", getPublicPortfolio);
router.get("/:slug/profile-image", getPublicProfileImage);
router.get("/:slug/resume", getPublicResume);

module.exports = router;
