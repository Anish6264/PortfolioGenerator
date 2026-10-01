const express = require("express");

const upload = require("../middleware/upload.middleware");

const protect = require("../middleware/auth.middleware");

const {
    uploadPortfolioFiles,
    removePortfolioResume,
    removePortfolioProfileImage,
    getPortfolioProfileImage
} = require("../controllers/upload.controller");


const router = express.Router();

router.get("/:portfolioId/profile-image", protect, getPortfolioProfileImage);
router.delete("/:portfolioId/resume", protect, removePortfolioResume);
router.delete("/:portfolioId/profile-image", protect, removePortfolioProfileImage);

router.post(
    "/:portfolioId",
    protect,
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
