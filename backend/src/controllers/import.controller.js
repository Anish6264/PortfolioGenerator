const fs = require("fs/promises");
const { parseResume, analyzePortfolioResume } = require("../services/resumeImport.service");
const {
    importGitHubProfile,
    normalizeGitHubReference
} = require("../services/githubImport.service");
const {
    reserveCredits,
    commitCreditReservation,
    refundCreditReservation
} = require("../services/creditReservation.service");

const GITHUB_PROJECT_IMPORT_COST = 2;
const GITHUB_PROJECT_IMPORT_OPERATION = "github_project_import";

const RESUME_ANALYSIS_MESSAGES = {
    INVALID_PORTFOLIO_ID: "Invalid portfolio ID.",
    PORTFOLIO_NOT_FOUND: "Portfolio not found.",
    RESUME_NOT_FOUND: "Upload a PDF resume before analyzing it.",
    RESUME_FILE_NOT_FOUND: "The stored resume could not be found. Upload the PDF again.",
    INVALID_STORED_RESUME: "The stored resume is not a valid supported PDF. Upload it again.",
    RESUME_ANALYSIS_NOT_CONFIGURED: "AI resume analysis is not configured.",
    RESUME_ANALYSIS_PROVIDER_ERROR: "Unable to analyze the resume right now. Please try again.",
    RESUME_ANALYSIS_INVALID_OUTPUT: "Resume analysis returned an invalid result. Please try again.",
    OPENROUTER_RATE_LIMIT: "Resume analysis is rate limited right now. Please try again later.",
    OPENROUTER_TIMEOUT: "Resume analysis timed out. Please try again.",
    OPENROUTER_UNAVAILABLE: "Resume analysis is temporarily unavailable. Please try again.",
    OPENROUTER_PROVIDER_ERROR: "Unable to analyze the resume right now. Please try again.",
    OPENROUTER_INVALID_RESPONSE: "Resume analysis returned an invalid result. Please try again."
};

const GITHUB_ERROR_MESSAGES = {
    GITHUB_USER_NOT_FOUND: "GitHub user not found.",
    GITHUB_RATE_LIMIT: "GitHub rate limit reached. Please try again later.",
    GITHUB_TIMEOUT: "Unable to reach GitHub right now.",
    GITHUB_UNAVAILABLE: "Unable to reach GitHub right now.",
    GITHUB_AUTH_FAILED: "GitHub authentication failed. Check the server configuration.",
    GITHUB_FORBIDDEN: "GitHub import failed.",
    GITHUB_API_ERROR: "GitHub import failed.",
    GITHUB_INVALID_RESPONSE: "GitHub returned an unexpected response.",
    GITHUB_IMPORT_FAILED: "GitHub import failed."
};

const importResume = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "Choose a PDF resume to import" });
        const result = await parseResume(req.file);
        return res.status(result.status === "not_configured" ? 503 : 200).json(result);
    } catch (error) {
        if (error.status === 400) return res.status(400).json({ message: error.message });
        console.error("Resume import boundary error:", error);
        return res.status(500).json({ message: "Unable to process this resume" });
    } finally {
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch((error) => {
                if (error.code !== "ENOENT") console.error("Resume import cleanup failed:", error.message);
            });
        }
    }
};

const importGitHub = async (req, res) => {
    const body = req.body || {};
    if (Object.keys(body).some((key) => key !== "reference")) {
        return res.status(400).json({
            code: "INVALID_GITHUB_IMPORT_REQUEST",
            message: "Only a GitHub username or profile URL can be imported."
        });
    }

    const username = normalizeGitHubReference(body.reference);
    if (!username) {
        return res.status(400).json({
            code: "INVALID_GITHUB_REFERENCE",
            message: "Enter a valid GitHub username or profile URL."
        });
    }

    if (typeof process.env.GITHUB_TOKEN !== "string" || !process.env.GITHUB_TOKEN.trim()) {
        return res.status(503).json({
            code: "GITHUB_NOT_CONFIGURED",
            message: "GitHub import is not configured."
        });
    }

    let reservation;
    try {
        const reserved = await reserveCredits({
            userId: req.user.id,
            credits: GITHUB_PROJECT_IMPORT_COST,
            operation: GITHUB_PROJECT_IMPORT_OPERATION
        });

        if (!reserved.reservation) {
            return res.status(402).json({
                code: "INSUFFICIENT_CREDITS",
                message: "GitHub Project Import requires 2 credits.",
                requiredCredits: GITHUB_PROJECT_IMPORT_COST,
                availableCredits: reserved.availableCredits
            });
        }
        reservation = reserved.reservation;

        const result = await importGitHubProfile(username);
        if (result.status !== "ready" || !Array.isArray(result.repositories)) {
            const error = new Error("GitHub import did not return a completed result");
            error.status = 502;
            error.code = "GITHUB_INVALID_RESPONSE";
            throw error;
        }

        return res.status(200).json({
            ...result,
            creditReservationId: String(reservation._id)
        });
    } catch (error) {
        let refunded = !reservation;
        if (reservation) {
            try {
                await refundCreditReservation(reservation._id, req.user.id, GITHUB_PROJECT_IMPORT_OPERATION);
                refunded = true;
            } catch (refundError) {
                console.error("GitHub import refund failed:", refundError?.code || "CREDIT_REFUND_FAILED");
            }
        }

        const knownMessage = GITHUB_ERROR_MESSAGES[error?.code];
        const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600
            ? error.status
            : 500;
        const code = error?.code || "GITHUB_IMPORT_FAILED";
        console.error("GitHub import failed:", code, status);

        if (!refunded) {
            return res.status(500).json({
                code: "GITHUB_IMPORT_REFUND_PENDING",
                message: "GitHub import failed and the credit refund could not be confirmed. Please contact support."
            });
        }

        return res.status(status).json({
            code,
            message: knownMessage || (reservation
                ? "GitHub import failed. Reserved credits were refunded."
                : "GitHub import failed.")
        });
    }
};

const completeGitHubReservation = async (req, res, action) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.reservationId || "")) {
        return res.status(400).json({ code: "INVALID_RESERVATION", message: "Invalid GitHub import reservation." });
    }
    if (Object.keys(req.body || {}).length) {
        return res.status(400).json({ code: "INVALID_RESERVATION", message: "This request does not accept a body." });
    }

    const shouldCommit = action === "commit";
    try {
        const complete = shouldCommit ? commitCreditReservation : refundCreditReservation;
        await complete(req.params.reservationId, req.user.id, GITHUB_PROJECT_IMPORT_OPERATION);
        return res.status(200).json({
            status: shouldCommit ? "committed" : "refunded",
            message: shouldCommit ? "GitHub import applied." : "GitHub import reservation refunded."
        });
    } catch (error) {
        if (error.message === "Credit reservation is no longer active") {
            return res.status(409).json({
                code: "RESERVATION_ALREADY_COMPLETED",
                message: "This GitHub import reservation is no longer pending."
            });
        }
        console.error("GitHub reservation completion failed:", error?.code || "CREDIT_RESERVATION_ERROR");
        return res.status(500).json({
            code: "RESERVATION_COMPLETION_FAILED",
            message: "The GitHub import could not be completed. Please retry."
        });
    }
};

const commitGitHubReservation = (req, res) => completeGitHubReservation(req, res, "commit");
const refundGitHubReservation = (req, res) => completeGitHubReservation(req, res, "refund");

const analyzeResume = async (req, res) => {
    try {
        const proposedData = await analyzePortfolioResume(req.body?.portfolioId, req.user.id);
        return res.status(200).json({
            status: "ready",
            source: "AI Resume Analysis",
            proposedData
        });
    } catch (error) {
        const knownMessage = RESUME_ANALYSIS_MESSAGES[error?.code];
        const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600
            ? error.status
            : 500;
        console.error("Resume AI analysis failed:", error?.code || "RESUME_ANALYSIS_FAILED", status);
        return res.status(status).json({
            message: knownMessage || "Unable to analyze the resume right now. Please try again."
        });
    }
};

module.exports = {
    importResume,
    importGitHub,
    analyzeResume,
    commitGitHubReservation,
    refundGitHubReservation
};
