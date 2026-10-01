const fs = require("fs/promises");
const { parseResume, analyzePortfolioResume } = require("../services/resumeImport.service");
const { importGitHubProfile } = require("../services/githubImport.service");

const RESUME_ANALYSIS_MESSAGES = {
    INVALID_PORTFOLIO_ID: "Invalid portfolio ID.",
    PORTFOLIO_NOT_FOUND: "Portfolio not found.",
    RESUME_NOT_FOUND: "Upload a PDF resume before analyzing it.",
    RESUME_FILE_NOT_FOUND: "The stored resume could not be found. Upload the PDF again.",
    INVALID_STORED_RESUME: "The stored resume is not a valid supported PDF. Upload it again.",
    RESUME_ANALYSIS_NOT_CONFIGURED: "AI resume analysis is not configured.",
    RESUME_ANALYSIS_PROVIDER_ERROR: "Unable to analyze the resume right now. Please try again.",
    RESUME_ANALYSIS_INVALID_OUTPUT: "Resume analysis returned an invalid result. Please try again."
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
    try {
        const result = await importGitHubProfile(req.body?.reference);
        return res.status(result.status === "not_configured" ? 503 : 200).json(result);
    } catch (error) {
        if (error.status === 400) return res.status(400).json({ message: error.message });
        // Log only our safe error code/status; never serialize upstream errors or request configuration.
        console.error("GitHub import failed:", error?.code || "GITHUB_IMPORT_FAILED", error?.status || 500);
        const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600 ? error.status : 500;
        return res.status(status).json({ message: GITHUB_ERROR_MESSAGES[error?.code] || "GitHub import failed." });
    }
};

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

module.exports = { importResume, importGitHub, analyzeResume };
