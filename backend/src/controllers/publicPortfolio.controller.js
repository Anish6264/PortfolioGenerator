const Portfolio = require("../models/Portfolio");
const { generatePortfolio, preparePreviewHtml, resolvePortfolioAssetPath } = require("../services/generator.service");
const path = require("path");

const validSlug = (slug) => typeof slug === "string" && slug.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);

const findPublishedPortfolio = (slug) => Portfolio.findOne({ slug, status: "published" });

const getPublicPortfolio = async (req, res) => {
    try {
        if (!validSlug(req.params.slug)) return res.status(400).json({ message: "Invalid portfolio URL" });

        const portfolio = await findPublishedPortfolio(req.params.slug);
        if (!portfolio) return res.status(404).json({ message: "Portfolio not found" });

        const generated = await generatePortfolio(String(portfolio._id), String(portfolio.user), {
            slug: req.params.slug,
            status: "published"
        });
        const personal = portfolio.personal || {};
        const title = portfolio.seoTitle || `${personal.name || "Portfolio"}${personal.title ? ` | ${personal.title}` : ""}`;
        const description = portfolio.seoDescription || portfolio.shortIntro || portfolio.about || "Professional portfolio";

        return res.status(200).json({
            html: preparePreviewHtml(generated),
            title,
            description,
            hasProfileImage: Boolean(generated.profileImagePath),
            hasResume: Boolean(generated.resumePath)
        });
    } catch (error) {
        console.error("Get public portfolio error:", error);
        if (error.status === 404) return res.status(404).json({ message: "Portfolio not found" });
        return res.status(500).json({ message: "Unable to load portfolio" });
    }
};

const sendAsset = (kind) => async (req, res) => {
    try {
        if (!validSlug(req.params.slug)) return res.status(400).json({ message: "Invalid portfolio URL" });
        const portfolio = await findPublishedPortfolio(req.params.slug);
        if (!portfolio) return res.status(404).json({ message: "Portfolio not found" });

        const storedPath = kind === "resume" ? portfolio.resume : portfolio.personal?.profileImage;
        const assetPath = resolvePortfolioAssetPath(storedPath);
        const extension = assetPath ? path.extname(assetPath).toLowerCase() : "";
        const accepted = kind === "resume" ? [".pdf"] : [".jpg", ".jpeg", ".png", ".webp"];
        if (!assetPath || !accepted.includes(extension)) return res.status(404).json({ message: "File not found" });

        res.type(kind === "resume" ? "application/pdf" : extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg");
        if (kind === "resume") res.set("Content-Disposition", "inline");
        return res.sendFile(assetPath, (error) => {
            if (error && !res.headersSent) res.status(error.statusCode === 404 ? 404 : 500).json({ message: "File not found" });
        });
    } catch (error) {
        console.error(`Get public ${kind} error:`, error);
        return res.status(500).json({ message: "Unable to load file" });
    }
};

module.exports = { getPublicPortfolio, getPublicProfileImage: sendAsset("image"), getPublicResume: sendAsset("resume") };
