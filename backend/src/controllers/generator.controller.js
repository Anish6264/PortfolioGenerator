const { ZipArchive } = require("archiver");

const {
    generatePortfolio,
    preparePreviewHtml
} = require("../services/generator.service");
const User = require("../models/User.js");
const Portfolio = require("../models/Portfolio");
const Template = require("../models/Template");

const isValidPortfolioId = (id) => /^[a-f\d]{24}$/i.test(id || "");

const sendGeneratorError = (res, error, operation) => {
    console.error(`${operation} error:`, error);

    if (error.status === 404 || error.statusCode === 404) {
        return res.status(404).json({
            message: "Portfolio not found"
        });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
        return res.status(400).json({
            message: "Invalid portfolio data"
        });
    }

    return res.status(500).json({
        message: "Server error"
    });
};


const generatePortfolioZip = async (req, res) => {
    let creditReserved = false;
    let generationCost = 0;

    const refundCredit = async () => {
        if (!creditReserved) {
            return;
        }

        creditReserved = false;

        try {
            await User.updateOne(
                { _id: req.user.id },
                { $inc: { credits: generationCost } }
            );
        } catch (error) {
            console.error("Credit refund error:", error);
        }
    };

    try {

        if (!isValidPortfolioId(req.params.portfolioId)) {
            return res.status(400).json({
                message: "Invalid portfolio ID"
            });
        }

        const portfolio = await Portfolio.findOne({
            _id: req.params.portfolioId,
            user: req.user.id
        });

        if (!portfolio) {
            return res.status(404).json({
                message: "Portfolio not found"
            });
        }

        const template = await Template.findById(portfolio.template);

        if (!template || !template.isActive) {
            return res.status(404).json({
                message: "Template not found"
            });
        }

        if (
            !Number.isInteger(template.creditCost) ||
            template.creditCost < 0 ||
            (template.isPremium && template.creditCost < 1)
        ) {
            throw new Error("Invalid template credit cost");
        }

        // Free templates created before per-template costs used zero; retain
        // the existing one-credit generation charge for those records.
        generationCost = template.creditCost || 1;

        const user = await User.findOneAndUpdate(
            {
                _id: req.user.id,
                credits: {
                    $gte: generationCost,
                    $mod: [1, 0]
                }
            },
            {
                $inc: { credits: -generationCost }
            },
            {
                new: true
            }
        );

        if (!user) {
            return res.status(402).json({
                message: "Insufficient credits"
            });
        }

        creditReserved = true;
        res.once("finish", () => {
            creditReserved = false;
        });
        res.once("close", () => {
            void refundCredit();
        });

        const result = await generatePortfolio(
            req.params.portfolioId,
            req.user.id
        );


        // ------------------------------------------
        // ZIP filename
        // ------------------------------------------

        const zipFileName =
            `${result.template.name
                .toLowerCase()
                .replace(/\s+/g, "-")}.zip`;


        res.attachment(zipFileName);


        // ------------------------------------------
        // Create ZIP
        // ------------------------------------------

        const archive = new ZipArchive({

            zlib: {
                level: 9
            }

        });


        archive.on("error", (error) => {
            console.error("Generate portfolio archive error:", error);
            void refundCredit();

            if (!res.headersSent) {
                res.status(500).json({
                    message: "Server error"
                });
            } else {
                res.destroy();
            }
        });


        archive.pipe(res);


        // ------------------------------------------
        // Portfolio files
        // ------------------------------------------

        archive.append(
            result.html,
            {
                name: "index.html"
            }
        );


        archive.append(
            result.css,
            {
                name: "style.css"
            }
        );


        archive.append(
            result.js,
            {
                name: "script.js"
            }
        );


        // ------------------------------------------
        // Profile Image
        // ------------------------------------------

        if (
            result.profileImagePath
        ) {

            archive.file(
                result.profileImagePath,
                {
                    name:
                        `assets/profile-image${
                            path.extname(
                                result.profileImagePath
                            )
                        }`
                }
            );

        }


        // ------------------------------------------
        // Resume
        // ------------------------------------------

        if (
            result.resumePath
        ) {

            archive.file(
                result.resumePath,
                {
                    name: "assets/resume.pdf"
                }
            );

        }


        // ------------------------------------------
        // Finalize ZIP
        // ------------------------------------------

        await archive.finalize();

    } catch (error) {
        await refundCredit();

        if (!res.headersSent) {
            return sendGeneratorError(res, error, "Generate portfolio");
        }

        console.error("Generate portfolio error:", error);
        res.destroy();

    }

};


const previewPortfolio = async (req, res) => {
    try {

        if (!isValidPortfolioId(req.params.portfolioId)) {
            return res.status(400).json({
                message: "Invalid portfolio ID"
            });
        }

        const result = await generatePortfolio(
            req.params.portfolioId,
            req.user.id
        );

        const html = preparePreviewHtml(result, { inlineAssets: true });

        // -----------------------------------------
        // Return generated HTML
        // -----------------------------------------

        res.status(200).json({
            html
        });

    } catch (error) {

        if (!res.headersSent) {
            return sendGeneratorError(res, error, "Preview portfolio");
        }

        console.error("Preview portfolio error:", error);
        res.destroy();
    }
};


module.exports = {
    generatePortfolioZip,
    previewPortfolio
};
