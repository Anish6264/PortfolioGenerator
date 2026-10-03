const express = require("express");

const upload = require("../middleware/upload.middleware");

const protect = require("../middleware/auth.middleware");
const createRateLimiter = require("../middleware/rateLimit.middleware");

const {
    uploadPortfolioFiles,
    removePortfolioResume,
    removePortfolioProfileImage,
    getPortfolioProfileImage
} = require("../controllers/upload.controller");


const router = express.Router();
const limitPortfolioUploads = createRateLimiter({ name: "portfolio-upload", windowMs: 15 * 60 * 1000, max: 20, byUser: true });
const limitPortfolioAssets = createRateLimiter({ name: "portfolio-assets", windowMs: 15 * 60 * 1000, max: 30, byUser: true });

router.get("/:portfolioId/profile-image", protect, limitPortfolioAssets, getPortfolioProfileImage);
router.delete("/:portfolioId/resume", protect, limitPortfolioAssets, removePortfolioResume);
router.delete("/:portfolioId/profile-image", protect, limitPortfolioAssets, removePortfolioProfileImage);

router.post(
    "/:portfolioId",
    protect,
    limitPortfolioUploads,
    upload.fields([
        {
            name: "profileImage",
            maxCount: 1
        },
        {
            name: "resume",
            maxCount: 1
        }
    ]),
    uploadPortfolioFiles
);


module.exports = router;
