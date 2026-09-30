const path = require("path");

const Portfolio = require("../models/Portfolio");

const isValidPortfolioId = (id) => /^[a-f\d]{24}$/i.test(id || "");


const uploadPortfolioFiles = async (req, res) => {

    try {

        const portfolioId =
            req.params.portfolioId;

        if (!isValidPortfolioId(portfolioId)) {
            return res.status(400).json({
                message: "Invalid portfolio ID"
            });
        }

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

        console.error("Upload files error:", error);

        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({
                message: "Invalid upload data"
            });
        }

        return res.status(500).json({
            message: "Server error"
        });
    }
};


module.exports = {
    uploadPortfolioFiles
};
