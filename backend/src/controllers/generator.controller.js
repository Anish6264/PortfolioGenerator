const { ZipArchive } = require("archiver");
const path = require("path");

const {
    generatePortfolio,
    preparePreviewHtml
} = require("../services/generator.service");
const Portfolio = require("../models/Portfolio");
const Template = require("../models/Template");
const {
    reservePortfolioDownload,
    commitCreditReservation,
    refundCreditReservation,
    refreshPortfolioDownloadReservation
} = require("../services/creditReservation.service");

const PORTFOLIO_GENERATION_OPERATION = "portfolio_generation";

const isValidPortfolioId = (id) => /^[a-f\d]{24}$/i.test(id || "");

const sendGeneratorError = (res, error, operation) => {
    console.error(`${operation} error:`, error);

    if (error.status === 404 || error.statusCode === 404) {
        return res.status(404).json({
            code: error.code || "PORTFOLIO_NOT_FOUND",
            message: error.code === "TEMPLATE_NOT_FOUND" ? "Template not found" : "Portfolio not found"
        });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
        return res.status(400).json({
            code: "GENERATION_ERROR",
            message: "Invalid portfolio data"
        });
    }

    return res.status(500).json({
        code: "GENERATION_ERROR",
        message: "Server error"
    });
};


const generatePortfolioZip = async (req, res) => {
    let reservationId = null;
    let reservationCompletion = null;
    let archive = null;
    let clientDisconnected = false;
    let reservationHeartbeat = null;
    const completeReservation = (status) => {
        if (!reservationId) return Promise.resolve();
        if (!reservationCompletion) {
            const complete = status === "committed" ? commitCreditReservation : refundCreditReservation;
            const completion = {
                status,
                promise: null
            };
            completion.promise = complete(reservationId, req.user.id, PORTFOLIO_GENERATION_OPERATION)
                .catch((error) => {
                    if (reservationCompletion === completion) reservationCompletion = null;
                    throw error;
                });
            reservationCompletion = completion;
        }
        return reservationCompletion.promise.then(() => reservationCompletion.status);
    };

    try {

        if (!isValidPortfolioId(req.params.portfolioId)) {
            return res.status(400).json({
                code: "GENERATION_ERROR",
                message: "Invalid portfolio ID"
            });
        }

        const portfolio = await Portfolio.findOne({
            _id: req.params.portfolioId,
            user: req.user.id
        });

        if (!portfolio) {
            return res.status(404).json({
                code: "PORTFOLIO_NOT_FOUND",
                message: "Portfolio not found"
            });
        }

        const template = await Template.findById(portfolio.template);

        if (!template || !template.isActive) {
            return res.status(404).json({
                code: "TEMPLATE_NOT_FOUND",
                message: "Template not found"
            });
        }

        const generationCost = template.isPremium === true ? template.creditCost : 1;
        if (!Number.isInteger(generationCost) || generationCost < 1) {
            throw new Error("Invalid template credit cost");
        }

        const reserved = await reservePortfolioDownload({
            userId: req.user.id,
            portfolioId: portfolio._id,
            templateId: template._id,
            credits: generationCost,
        });

        if (reserved.status === "not_found") {
            return res.status(404).json({ code: "PORTFOLIO_NOT_FOUND", message: "Portfolio not found" });
        }
        if (reserved.status === "template_changed") {
            return res.status(409).json({ code: "PORTFOLIO_CHANGED", message: "The selected template changed. Please retry the download." });
        }
        if (reserved.status === "in_progress") {
            return res.status(409).json({ code: "DOWNLOAD_IN_PROGRESS", message: "A first download is already in progress. Please retry shortly." });
        }
        if (reserved.status === "insufficient_credits") {
            return res.status(402).json({
                code: "INSUFFICIENT_CREDITS",
                message: "Insufficient credits",
                requiredCredits: generationCost,
                availableCredits: reserved.availableCredits
            });
        }

        if (reserved.status === "reserved") {
            reservationId = reserved.reservation._id;
            res.once("close", () => {
                if (res.writableFinished) return;
                clientDisconnected = true;
                clearInterval(reservationHeartbeat);
                archive?.abort();
                void completeReservation("refunded").catch((error) => {
                    console.error("Portfolio generation refund failed:", error?.code || "CREDIT_RESERVATION_ERROR");
                });
            });
            reservationHeartbeat = setInterval(() => {
                void refreshPortfolioDownloadReservation(reservationId, req.user.id).catch((error) => {
                    console.error("Portfolio download reservation heartbeat failed:", error?.code || "CREDIT_RESERVATION_ERROR");
                });
            }, 60 * 1000);
            reservationHeartbeat.unref?.();
        }

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

        archive = new ZipArchive({

            zlib: {
                level: 9
            }

        });


        const archiveOutput = new Promise((resolve, reject) => {
            archive.once("end", resolve);
            archive.once("error", reject);
        });

        if (clientDisconnected) {
            archive.abort();
            return;
        }
        archive.pipe(res, { end: false });


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
        await archiveOutput;

        if (reservationId) {
            const completionStatus = await completeReservation("committed");
            if (completionStatus !== "committed" || clientDisconnected || res.destroyed) {
                if (!res.destroyed) res.destroy();
                return;
            }
        }

        if (!clientDisconnected && !res.destroyed) res.end();

    } catch (error) {
        archive?.abort();
        if (reservationHeartbeat) clearInterval(reservationHeartbeat);
        try {
            await completeReservation("refunded");
        } catch (refundError) {
            console.error("Portfolio generation refund failed:", refundError?.code || "CREDIT_RESERVATION_ERROR");
        }

        if (clientDisconnected || res.destroyed) return;
        if (!res.headersSent) {
            return sendGeneratorError(res, error, "Generate portfolio");
        }

        console.error("Generate portfolio error:", error);
        res.destroy();
    } finally {
        if (reservationHeartbeat) clearInterval(reservationHeartbeat);

    }

};


const previewPortfolio = async (req, res) => {
    try {

        if (!isValidPortfolioId(req.params.portfolioId)) {
            return res.status(400).json({
                code: "GENERATION_ERROR",
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
