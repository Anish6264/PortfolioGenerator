const express = require("express");

const upload = require("../middleware/upload.middleware");

const protect = require("../middleware/auth.middleware");

const {
    uploadPortfolioFiles
} = require("../controllers/upload.controller");


const router = express.Router();


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