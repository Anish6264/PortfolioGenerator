const fs = require("fs/promises");
const { parseResume } = require("../services/resumeImport.service");
const { importGitHubProfile } = require("../services/githubImport.service");

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
        console.error("GitHub import boundary error:", error);
        return res.status(500).json({ message: "Unable to prepare GitHub import" });
    }
};

module.exports = { importResume, importGitHub };
