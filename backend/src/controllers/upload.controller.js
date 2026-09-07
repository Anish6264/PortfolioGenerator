const path = require("path");

const Portfolio = require("../models/Portfolio");


const uploadPortfolioFiles = async (req, res) => {

    try {

        const portfolioId =
            req.params.portfolioId;

        const portfolio =
            await Portfolio.findOne({
                _id: portfolioId,
                user: req.user.id
            });

        if (!portfolio) {
            return res.status(404).json({
                message: "Portfolio not found"
            });
        }


        if (req.files?.profileImage) {

            const image =
                req.files.profileImage[0];

            portfolio.personal.profileImage =
                path.join(
                    "uploads",
                    image.filename
                ).replaceAll("\\", "/");
        }


        if (req.files?.resume) {

            const resume =
                req.files.resume[0];

            portfolio.resume =
                path.join(
                    "uploads",
                    resume.filename
                ).replaceAll("\\", "/");
        }


        await portfolio.save();


        res.status(200).json({
            message: "Files uploaded successfully",
            portfolio
        });

    } catch (error) {

        console.error(
            "Upload files error:",
            error.message
        );

        res.status(500).json({
            message:
                error.message ||
                "Failed to upload files"
        });
    }
};


module.exports = {
    uploadPortfolioFiles
};