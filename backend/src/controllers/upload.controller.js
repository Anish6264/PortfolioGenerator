const path = require("path");
const Portfolio = require("../models/Portfolio");
const {
    getManagedUploadPath,
    removeManagedUpload,
    sanitizeOriginalFilename
} = require("../services/uploadAssets.service");

const isValidPortfolioId = (id) => /^[a-f\d]{24}$/i.test(id || "");
const assetField = {
    resume: { reference: "resume", originalName: "resumeOriginalName" },
    profileImage: { reference: "profileImage", originalName: "profileImageOriginalName" }
};

const portfolioAssetResponse = (portfolio) => ({
    portfolio,
    assets: {
        resume: {
            reference: portfolio.resume || "",
            originalName: portfolio.resumeOriginalName || ""
        },
        profileImage: {
            reference: portfolio.personal?.profileImage || "",
            originalName: portfolio.personal?.profileImageOriginalName || ""
        }
    }
});

const findOwnedPortfolio = async (portfolioId, userId) => {
    if (!isValidPortfolioId(portfolioId)) return { error: { status: 400, message: "Invalid portfolio ID." } };
    const portfolio = await Portfolio.findOne({ _id: portfolioId, user: userId });
    if (!portfolio) return { error: { status: 404, message: "Portfolio not found." } };
    return { portfolio };
};

const isReferencedElsewhere = async (portfolio, kind, reference) => {
    if (!reference) return false;
    const query = kind === "resume"
        ? { _id: { $ne: portfolio._id }, resume: reference }
        : { _id: { $ne: portfolio._id }, "personal.profileImage": reference };
    return Boolean(await Portfolio.exists(query));
};

const cleanupReplacedUpload = async (portfolio, kind, oldReference, newReference) => {
    try {
        if (!oldReference || oldReference === newReference || await isReferencedElsewhere(portfolio, kind, oldReference)) return;
        await removeManagedUpload(oldReference, kind);
    } catch (error) {
        // The new upload is already saved. Keep the valid new asset and log only a safe code.
        console.error("Replaced upload cleanup failed:", error?.code || "UPLOAD_CLEANUP_FAILED");
    }
};

const uploadPortfolioFiles = async (req, res) => {
    const uploadedFiles = [
        ...(req.files?.resume || []).map((file) => ({ file, kind: "resume" })),
        ...(req.files?.profileImage || []).map((file) => ({ file, kind: "profileImage" }))
    ];
    const cleanupNewUploads = () => Promise.all(uploadedFiles.map(({ file, kind }) =>
        removeManagedUpload(path.posix.join("uploads", file.filename), kind).catch(() => {})
    ));
    let portfolioSaved = false;

    try {
        const result = await findOwnedPortfolio(req.params.portfolioId, req.user.id);
        if (result.error) {
            await cleanupNewUploads();
            return res.status(result.error.status).json({ message: result.error.message });
        }
        const { portfolio } = result;
        const replaced = [];

        if (req.files?.profileImage?.[0]) {
            const image = req.files.profileImage[0];
            const oldReference = portfolio.personal.profileImage || "";
            const reference = path.posix.join("uploads", image.filename);
            portfolio.personal.profileImage = reference;
            portfolio.personal.profileImageOriginalName = sanitizeOriginalFilename(image.originalname, "profile-image");
            replaced.push({ kind: "profileImage", oldReference, newReference: reference });
        }

        if (req.files?.resume?.[0]) {
            const resume = req.files.resume[0];
            const oldReference = portfolio.resume || "";
            const reference = path.posix.join("uploads", resume.filename);
            portfolio.resume = reference;
            portfolio.resumeOriginalName = sanitizeOriginalFilename(resume.originalname, "resume.pdf");
            replaced.push({ kind: "resume", oldReference, newReference: reference });
        }

        await portfolio.save();
        portfolioSaved = true;
        for (const item of replaced) {
            await cleanupReplacedUpload(portfolio, item.kind, item.oldReference, item.newReference);
        }

        return res.status(200).json({ message: "Files uploaded successfully", ...portfolioAssetResponse(portfolio) });
    } catch (error) {
        if (!portfolioSaved) await cleanupNewUploads();
        if (["ValidationError", "CastError"].includes(error?.name)) {
            return res.status(400).json({ message: "Invalid upload data." });
        }
        console.error("Upload files error:", error?.code || error?.name || "UPLOAD_FAILED");
        return res.status(500).json({ message: "Unable to upload files." });
    }
};

const removePortfolioAsset = (kind) => async (req, res) => {
    try {
        const result = await findOwnedPortfolio(req.params.portfolioId, req.user.id);
        if (result.error) return res.status(result.error.status).json({ message: result.error.message });
        const { portfolio } = result;
        const fields = assetField[kind];
        const owner = kind === "resume" ? portfolio : portfolio.personal;
        const reference = owner?.[fields.reference] || "";
        if (!reference) return res.status(404).json({ message: `No ${kind === "resume" ? "resume" : "profile image"} is uploaded.` });

        const isExternalImageUrl = kind === "profileImage" && /^https?:\/\//i.test(reference);
        if (!isExternalImageUrl && !await isReferencedElsewhere(portfolio, kind, reference)) {
            await removeManagedUpload(reference, kind);
        }

        owner[fields.reference] = "";
        owner[fields.originalName] = "";
        await portfolio.save();
        return res.status(200).json({
            message: `${kind === "resume" ? "Resume" : "Profile image"} removed successfully.`,
            ...portfolioAssetResponse(portfolio)
        });
    } catch (error) {
        console.error("Portfolio asset removal failed:", error?.code || error?.name || "ASSET_REMOVAL_FAILED");
        return res.status(500).json({ message: "Unable to remove this file. Please try again." });
    }
};

const getPortfolioProfileImage = async (req, res) => {
    try {
        const result = await findOwnedPortfolio(req.params.portfolioId, req.user.id);
        if (result.error) return res.status(result.error.status).json({ message: result.error.message });
        const reference = result.portfolio.personal?.profileImage;
        const imagePath = await getManagedUploadPath(reference, "profileImage");
        if (!imagePath) return res.status(404).json({ message: "Profile image not found." });
        const extension = path.extname(imagePath).toLowerCase();
        res.type(extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg");
        return res.sendFile(imagePath, (error) => {
            if (error && !res.headersSent) res.status(404).json({ message: "Profile image not found." });
        });
    } catch (error) {
        console.error("Profile image preview failed:", error?.code || error?.name || "IMAGE_PREVIEW_FAILED");
        return res.status(500).json({ message: "Unable to load profile image." });
    }
};

module.exports = {
    uploadPortfolioFiles,
    removePortfolioResume: removePortfolioAsset("resume"),
    removePortfolioProfileImage: removePortfolioAsset("profileImage"),
    getPortfolioProfileImage
};
