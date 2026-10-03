const Portfolio = require("../models/Portfolio");
const fs = require("fs");
const { generatePortfolio, preparePreviewHtml, resolvePortfolioAssetPath } = require("../services/generator.service");
const { recordEvent } = require("../services/portfolioAnalytics.service");
const path = require("path");

const validSlug = (slug) => typeof slug === "string" && slug.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);

const findPublishedPortfolio = (slug) => Portfolio.findOne({ slug, status: "published" });

const safeExternalUrl = (value) => {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
        const parsed = new URL(value.trim());
        return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
    } catch {
        return "";
    }
};

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
        recordEvent(portfolio._id, "view");
        const html = preparePreviewHtml(generated).replace(
            /<a\b(?=[^>]*data-project-link="(live|github)")(?=[^>]*data-project-index="(\d+)")[^>]*>/gi,
            (anchor, linkType, projectIndex) => anchor.replace(
                /href="[^"]*"/i,
                `href="/api/public/portfolios/${req.params.slug}/project/${projectIndex}/${linkType}"`
            )
        );

        return res.status(200).json({
            html,
            title,
            description,
            hasProfileImage: Boolean(generated.profileImagePath),
            hasResume: Boolean(generated.resumePath)
        });
    } catch (error) {
        console.error("Get public portfolio error:", error?.name || "PUBLIC_PORTFOLIO_ERROR", error?.code || "UNKNOWN");
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
        const assetPath = await resolvePortfolioAssetPath(storedPath, kind === "image" ? "profileImage" : kind);
        const extension = assetPath ? path.extname(assetPath).toLowerCase() : "";
        const accepted = kind === "resume" ? [".pdf"] : [".jpg", ".jpeg", ".png", ".webp"];
        if (!assetPath || !accepted.includes(extension) || !fs.existsSync(assetPath)) {
            return res.status(404).json({ message: "File not found" });
        }

        if (kind === "resume") recordEvent(portfolio._id, "resume-click");

        res.type(kind === "resume" ? "application/pdf" : extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg");
        if (kind === "resume") res.set("Content-Disposition", "inline");
        return res.sendFile(assetPath, (error) => {
            if (error && !res.headersSent) res.status(error.statusCode === 404 ? 404 : 500).json({ message: "File not found" });
        });
    } catch (error) {
        console.error(`Get public ${kind} error:`, error?.name || "PUBLIC_ASSET_ERROR", error?.code || "UNKNOWN");
        return res.status(500).json({ message: "Unable to load file" });
    }
};

const trackAndRedirectProjectLink = async (req, res) => {
    try {
        if (!validSlug(req.params.slug)) return res.status(400).json({ message: "Invalid portfolio URL" });
        const portfolio = await findPublishedPortfolio(req.params.slug);
        if (!portfolio) return res.status(404).json({ message: "Portfolio not found" });

        const projectIndex = Number(req.params.projectIndex);
        if (!Number.isInteger(projectIndex) || projectIndex < 0 || projectIndex >= (portfolio.projects || []).length) {
            return res.status(404).json({ message: "Project link not found" });
        }
        const project = portfolio.projects[projectIndex];
        const target = req.params.linkType === "live"
            ? safeExternalUrl(project.liveUrl)
            : req.params.linkType === "github"
                ? safeExternalUrl(project.githubUrl)
                : "";
        if (!target) return res.status(404).json({ message: "Project link not found" });

        recordEvent(portfolio._id, "project-click");
        return res.redirect(302, target);
    } catch (error) {
        console.error("Track portfolio project link error:", error?.name || "PUBLIC_PROJECT_LINK_ERROR", error?.code || "UNKNOWN");
        return res.status(500).json({ message: "Unable to open project link" });
    }
};

module.exports = {
    getPublicPortfolio,
    getPublicProfileImage: sendAsset("image"),
    getPublicResume: sendAsset("resume"),
    trackAndRedirectProjectLink
};
