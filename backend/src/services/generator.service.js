const fs = require("fs");
const path = require("path");

const Portfolio = require("../models/Portfolio");
const Template = require("../models/Template");
const templateContract = require("./templateContract");
const { getManagedUploadPath } = require("./uploadAssets.service");

const supportedSections = [
    "about",
    "education",
    "experience",
    "skills",
    "projects",
    "contact"
];

const defaultColors = {
    primaryColor: "#111827",
    secondaryColor: "#6b7280",
    backgroundColor: "#ffffff",
    textColor: "#1f2937"
};

const fontFamilies = {
    Arial: "Arial, sans-serif",
    Inter: "Inter, Arial, sans-serif",
    Poppins: "Poppins, Arial, sans-serif",
    Roboto: "Roboto, Arial, sans-serif",
    "Open Sans": "'Open Sans', Arial, sans-serif",
    Merriweather: "Merriweather, Georgia, serif"
};

const templateRoot = path.resolve(__dirname, "../templates");
const requiredTemplateFiles = templateContract.requiredFiles;

const resolveTemplateDirectory = (templatePath) => {
    if (typeof templatePath !== "string" || !/^[a-z\d][a-z\d_-]*$/i.test(templatePath)) {
        const error = new Error("Template configuration is invalid");
        error.code = "INVALID_TEMPLATE";
        throw error;
    }
    const directory = path.resolve(templateRoot, templatePath);
    const relative = path.relative(templateRoot, directory);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
        const error = new Error("Template configuration is invalid");
        error.code = "INVALID_TEMPLATE";
        throw error;
    }
    return directory;
};

const readTemplateFiles = (templatePath) => {
    const directory = resolveTemplateDirectory(templatePath);
    try {
        const realRoot = fs.realpathSync(templateRoot);
        const realDirectory = fs.realpathSync(directory);
        const directoryRelative = path.relative(realRoot, realDirectory);
        if (!directoryRelative || directoryRelative.startsWith("..") || path.isAbsolute(directoryRelative)) {
            throw new Error("Invalid template location");
        }
        const files = {};
        for (const filename of requiredTemplateFiles) {
            const filePath = path.join(directory, filename);
            const realFile = fs.realpathSync(filePath);
            const fileRelative = path.relative(realDirectory, realFile);
            if (fileRelative.startsWith("..") || path.isAbsolute(fileRelative) || !fs.statSync(realFile).isFile()) {
                throw new Error("Invalid template file");
            }
            files[filename] = fs.readFileSync(realFile, "utf8");
        }
        return files;
    } catch {
        const error = new Error("Template files are unavailable");
        error.code = "INVALID_TEMPLATE";
        throw error;
    }
};

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);

const normalizePortfolioForTemplate = (portfolio = {}) => {
    const plainPortfolio = portfolio && typeof portfolio.toObject === "function"
        ? portfolio.toObject({ depopulate: true })
        : portfolio;
    const source = isObject(plainPortfolio) ? plainPortfolio : {};
    const personal = isObject(source.personal) ? source.personal : {};
    const social = isObject(source.social) ? source.social : {};
    const sectionVisibility = isObject(source.sectionVisibility) ? source.sectionVisibility : {};
    const sectionOrder = Array.isArray(source.sectionOrder)
        ? [...new Set(source.sectionOrder)].filter((section) => supportedSections.includes(section))
        : [];
    const customSections = Array.isArray(source.customSections)
        ? source.customSections.filter((item) => isObject(item) && typeof item.title === "string")
            .map((item) => ({ title: item.title.slice(0, 80), content: typeof item.content === "string" ? item.content.slice(0, 4000) : "" }))
        : [];
    return {
        ...source,
        personal,
        social,
        skills: Array.isArray(source.skills) ? source.skills.filter((item) => typeof item === "string") : [],
        education: Array.isArray(source.education) ? source.education.filter(isObject) : [],
        experience: Array.isArray(source.experience) ? source.experience.filter(isObject) : [],
        projects: Array.isArray(source.projects) ? source.projects.filter(isObject).map((project) => ({
            ...project,
            technologies: Array.isArray(project.technologies) ? project.technologies.filter((item) => typeof item === "string") : []
        })) : [],
        sectionVisibility: Object.fromEntries(Object.entries(sectionVisibility).filter(([key, value]) => supportedSections.includes(key) && typeof value === "boolean")),
        sectionOrder,
        customSections,
        seoTitle: typeof source.seoTitle === "string" ? source.seoTitle.slice(0, 70) : "",
        seoDescription: typeof source.seoDescription === "string" ? source.seoDescription.slice(0, 200) : "",
        shortIntro: typeof source.shortIntro === "string" ? source.shortIntro : "",
        about: typeof source.about === "string" ? source.about : ""
    };
};

const escapeHtml = (value) => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const safeExternalUrl = (value) => {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
        const parsed = new URL(value.trim());
        return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
    } catch {
        return "";
    }
};

const resolvePortfolioAssetPath = async (storedPath, kind) => {
    try {
        return await getManagedUploadPath(storedPath, kind);
    } catch {
        return null;
    }
};

const getSafeColor = (value, fallback) =>
    typeof value === "string" && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)
        ? value
        : fallback;

const sectionPattern = (section) =>
    new RegExp(`<section\\b[^>]*\\bid=["']${section}["'][^>]*>[\\s\\S]*?<\\/section>`, "i");

const hideSections = (html, visibility = {}) => {
    let updatedHtml = html;

    for (const section of supportedSections) {
        if (visibility[section] !== false) {
            continue;
        }

        updatedHtml = updatedHtml.replace(sectionPattern(section), (markup) =>
            markup.replace(/<section\b/i, "<section hidden")
        );

        const navLinkPattern = new RegExp(
            `<a\\b[^>]*href=["']#${section}["'][^>]*>[\\s\\S]*?<\\/a>`,
            "gi"
        );
        updatedHtml = updatedHtml.replace(navLinkPattern, "");
    }

    return updatedHtml;
};

const reorderNavigationLinks = (html, requestedOrder) =>
    html.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, (navigation) => {
        const links = supportedSections
            .map((section) => {
                const pattern = new RegExp(
                    `<a\\b(?=[^>]*href=["']#${section}["'])[^>]*>[\\s\\S]*?<\\/a>`,
                    "i"
                );
                const match = navigation.match(pattern);
                return match
                    ? { section, markup: match[0], position: match.index }
                    : null;
            })
            .filter(Boolean)
            .sort((left, right) => left.position - right.position);

        if (links.length < 2) {
            return navigation;
        }

        let updatedNavigation = navigation;
        for (const { section } of links) {
            const pattern = new RegExp(
                `<a\\b(?=[^>]*href=["']#${section}["'])[^>]*>[\\s\\S]*?<\\/a>`,
                "i"
            );
            updatedNavigation = updatedNavigation.replace(
                pattern,
                `<!--PORTFOLIO_NAV_${section}-->`
            );
        }

        const actualOrder = links.map(({ section }) => section);
        const requested = Array.isArray(requestedOrder)
            ? [...new Set(requestedOrder)].filter((section) => actualOrder.includes(section))
            : [];
        const safeOrder = [
            ...requested,
            ...actualOrder.filter((section) => !requested.includes(section))
        ];
        const slotMarker = "<!--PORTFOLIO_NAV_ORDER_SLOT-->";
        updatedNavigation = updatedNavigation.replace(
            `<!--PORTFOLIO_NAV_${actualOrder[0]}-->`,
            slotMarker
        );
        updatedNavigation = updatedNavigation.replace(/<!--PORTFOLIO_NAV_[a-z-]+-->/g, "");

        const orderedLinks = safeOrder
            .map((section) => links.find((link) => link.section === section)?.markup || "")
            .join("\n");

        return updatedNavigation.replace(slotMarker, orderedLinks);
    });

const reorderSections = (html, requestedOrder = []) => {
    const actualOrder = supportedSections
        .map((section) => ({
            section,
            position: html.search(sectionPattern(section))
        }))
        .filter(({ position }) => position >= 0)
        .sort((left, right) => left.position - right.position)
        .map(({ section }) => section);
    let updatedHtml = html;

    for (const section of supportedSections) {
        updatedHtml = updatedHtml.replace(
            sectionPattern(section),
            `<!--PORTFOLIO_SECTION_${section}-->`
        );
    }

    if (actualOrder.length < 2) {
        return updatedHtml.replace(/<!--PORTFOLIO_SECTION_([a-z-]+)-->/g, (_, section) => {
            const match = html.match(sectionPattern(section));
            return match ? match[0] : "";
        });
    }

    const safeRequestedOrder = Array.isArray(requestedOrder)
        ? [...new Set(requestedOrder)].filter((section) => actualOrder.includes(section))
        : [];
    const orderedSections = [
        ...safeRequestedOrder,
        ...actualOrder.filter((section) => !safeRequestedOrder.includes(section))
    ];
    const slotMarker = "<!--PORTFOLIO_SECTION_ORDER_SLOT-->";
    const firstMarker = `<!--PORTFOLIO_SECTION_${actualOrder[0]}-->`;

    updatedHtml = updatedHtml.replace(firstMarker, slotMarker);
    updatedHtml = updatedHtml.replace(/<!--PORTFOLIO_SECTION_([a-z-]+)-->/g, "");

    const orderedMarkup = orderedSections
        .map((section) => html.match(sectionPattern(section))?.[0] || "")
        .join("\n");

    updatedHtml = updatedHtml.replace(slotMarker, orderedMarkup);
    return reorderNavigationLinks(updatedHtml, orderedSections);
};

const buildCustomSectionsHtml = (customSections = []) =>
    customSections
        .filter((section) => section && typeof section.title === "string")
        .map((section, index) => `
            <section class="section custom-section" id="custom-section-${index + 1}">
                <div class="container">
                    <div class="section-heading"><h2>${escapeHtml(section.title)}</h2></div>
                    <div class="custom-section-content">${escapeHtml(section.content || "").replace(/\r?\n/g, "<br>")}</div>
                </div>
            </section>
        `)
        .join("\n");

const addPortfolioMetadata = (html, portfolio, imageAsset) => {
    const personal = portfolio.personal || {};
    const title = (portfolio.seoTitle || `${personal.name || "Portfolio"}${personal.title ? ` | ${personal.title}` : ""}`).trim();
    const description = (
        portfolio.seoDescription ||
        portfolio.shortIntro ||
        portfolio.about ||
        `${personal.name || "Portfolio"}'s professional portfolio`
    ).trim();

    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description);
    const metadata = [
        `<meta name="description" content="${safeDescription}">`,
        `<meta property="og:title" content="${safeTitle}">`,
        `<meta property="og:description" content="${safeDescription}">`,
        '<meta property="og:type" content="website">'
    ];

    if (imageAsset) {
        metadata.push(`<meta property="og:image" content="${escapeHtml(imageAsset)}">`);
        metadata.push(`<link rel="icon" href="${escapeHtml(imageAsset)}">`);
    }

    let updatedHtml = html.replace(
        /<title\b[^>]*>[\s\S]*?<\/title>/i,
        `<title>${safeTitle}</title>`
    );

    updatedHtml = updatedHtml
        .replace(/<meta\s+name=["']description["'][^>]*>/gi, "")
        .replace(/<meta\s+property=["']og:[^"']+["'][^>]*>/gi, "")
        .replace(/<link\s+rel=["']icon["'][^>]*>/gi, "");

    return updatedHtml.replace(/<\/head>/i, `${metadata.join("\n")}\n</head>`);
};

const applyPortfolioSettings = (html, portfolio, imageAsset) => {
    const visibility = { ...portfolio.sectionVisibility };
    if (!portfolio.about.trim() && !portfolio.shortIntro.trim()) visibility.about = false;
    if (!portfolio.education.length) visibility.education = false;
    if (!portfolio.experience.length) visibility.experience = false;
    if (!portfolio.skills.length) visibility.skills = false;
    if (!portfolio.projects.length) visibility.projects = false;
    if (![portfolio.personal.email, portfolio.personal.phone, portfolio.personal.location, ...Object.values(portfolio.social)]
        .some((value) => typeof value === "string" && value.trim())) visibility.contact = false;

    let updatedHtml = hideSections(html, visibility);
    updatedHtml = reorderSections(updatedHtml, portfolio.sectionOrder);

    const customSectionsHtml = buildCustomSectionsHtml(portfolio.customSections);
    if (customSectionsHtml) {
        if (/<footer\b/i.test(updatedHtml)) {
            updatedHtml = updatedHtml.replace(/<footer\b/i, `${customSectionsHtml}\n<footer`);
        } else {
            updatedHtml = updatedHtml.replace(/<\/body>/i, `${customSectionsHtml}\n</body>`);
        }
    }

    return addPortfolioMetadata(updatedHtml, portfolio, imageAsset);
};

const buildCustomizationCss = (portfolio) => {
    const colors = Object.fromEntries(
        Object.entries(defaultColors).map(([key, fallback]) => [
            key,
            getSafeColor(portfolio[key], fallback)
        ])
    );
    const fontFamily = Object.prototype.hasOwnProperty.call(fontFamilies, portfolio.fontFamily)
        ? fontFamilies[portfolio.fontFamily]
        : fontFamilies.Arial;

    return `\n\n:root {
    --portfolio-primary: ${colors.primaryColor};
    --portfolio-secondary: ${colors.secondaryColor};
    --portfolio-background: ${colors.backgroundColor};
    --portfolio-text: ${colors.textColor};
}
body { color: var(--portfolio-text); background-color: var(--portfolio-background); font-family: ${fontFamily}; }
.navbar { background-color: var(--portfolio-background); }
a:hover, .logo, .section-heading p { color: var(--portfolio-primary); }
.primary-btn { color: #ffffff; background-color: var(--portfolio-primary); border-color: var(--portfolio-primary); }
.secondary-btn { color: var(--portfolio-secondary); border-color: var(--portfolio-secondary); }
.custom-section-content { white-space: normal; }\n`;
};


// ==================================================
// SKILLS HTML
// ==================================================

const generateSkillsHTML = (skills) => {

    return skills
        .map((skill) => {

            return `
                <span class="skill">
                    ${escapeHtml(skill)}
                </span>
            `;

        })
        .join("\n");

};


// ==================================================
// EDUCATION HTML
// ==================================================

const generateEducationHTML = (education) => {

    return education
        .map((item) => {

            return `
                <div class="education-card">

                    <h3>
                        ${escapeHtml(item.degree || "")}
                    </h3>

                    <h4>
                        ${escapeHtml(item.institution || "")}
                    </h4>

                    <p>
                        ${escapeHtml(item.startYear || "")}
                        -
                        ${escapeHtml(item.endYear || "")}
                    </p>

                    ${
                        item.description
                            ? `
                                <p>
                                    ${escapeHtml(item.description)}
                                </p>
                            `
                            : ""
                    }

                </div>
            `;

        })
        .join("\n");

};


// ==================================================
// EXPERIENCE HTML
// ==================================================

const generateExperienceHTML = (experience) => {

    return experience
        .map((item) => {

            return `
                <div class="experience-card">

                    <h3>
                        ${escapeHtml(item.role || "")}
                    </h3>

                    <h4>
                        ${escapeHtml(item.company || "")}
                    </h4>

                    <p>
                        ${escapeHtml(item.startDate || "")}
                        -
                        ${escapeHtml(item.endDate || "Present")}
                    </p>

                    ${
                        item.description
                            ? `
                                <p>
                                    ${escapeHtml(item.description)}
                                </p>
                            `
                            : ""
                    }

                </div>
            `;

        })
        .join("\n");

};


// ==================================================
// PROJECTS HTML
// ==================================================

const generateProjectsHTML = (projects) => {

    return projects
        .map((project, projectIndex) => {


            // --------------------------------------
            // Technologies
            // --------------------------------------

            const technologiesHTML =
                (project.technologies || [])
                    .map((technology) => {

                        return `
                            <span class="project-tech">
                                ${escapeHtml(technology)}
                            </span>
                        `;

                    })
                    .join("\n");


            // --------------------------------------
            // Project Links
            // --------------------------------------

            const liveUrl = safeExternalUrl(project.liveUrl);
            const githubUrl = safeExternalUrl(project.githubUrl);
            const liveLink =
                liveUrl
                    ? `
                        <a
                            data-project-link="live"
                            data-project-index="${projectIndex}"
                            href="${escapeHtml(liveUrl)}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Live Demo
                        </a>
                    `
                    : "";


            const githubLink =
                githubUrl
                    ? `
                        <a
                            data-project-link="github"
                            data-project-index="${projectIndex}"
                            href="${escapeHtml(githubUrl)}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            GitHub
                        </a>
                    `
                    : "";


            // --------------------------------------
            // Project Card
            // --------------------------------------

            return `
                <div class="project-card">

                    <h3>
                        ${escapeHtml(project.title || "")}
                    </h3>


                    <p>
                        ${escapeHtml(project.description || "")}
                    </p>


                    ${
                        technologiesHTML
                            ? `
                                <div class="project-technologies">
                                    ${technologiesHTML}
                                </div>
                            `
                            : ""
                    }


                    ${
                        liveLink || githubLink
                            ? `
                                <div class="project-links">
                                    ${liveLink}
                                    ${githubLink}
                                </div>
                            `
                            : ""
                    }

                </div>
            `;

        })
        .join("\n");

};


// ==================================================
// PLACEHOLDER REPLACEMENT
// ==================================================

const replacePlaceholders = (html, portfolio, imageAvailable, resumeAvailable) => {
    const personal = portfolio.personal || {};
    const social = portfolio.social || {};
    const profileImageForHTML = imageAvailable
        ? `assets/profile-image${path.extname(personal.profileImage).toLowerCase()}`
        : "";
    let updatedHtml = html;

    if (!imageAvailable) {
        updatedHtml = updatedHtml.replace(/<img\b[^>]*src=["']{{profileImage}}["'][^>]*>/gi, "");
    }
    if (!resumeAvailable) {
        updatedHtml = updatedHtml.replace(/<a\b[^>]*href=["']{{resume}}["'][^>]*>[\s\S]*?<\/a>/gi, "");
    }
    for (const [key, value] of Object.entries({
        github: safeExternalUrl(social.github),
        linkedin: safeExternalUrl(social.linkedin),
        twitter: safeExternalUrl(social.twitter)
    })) {
        if (!value) {
            updatedHtml = updatedHtml.replace(
                new RegExp(`<a\\b[^>]*href=["']{{${key}}}["'][^>]*>[\\s\\S]*?<\\/a>`, "gi"),
                ""
            );
        }
    }

    return updatedHtml
        .replaceAll("{{name}}", escapeHtml(personal.name || ""))
        .replaceAll("{{title}}", escapeHtml(personal.title || ""))
        .replaceAll("{{email}}", escapeHtml(personal.email || ""))
        .replaceAll("{{phone}}", escapeHtml(personal.phone || ""))
        .replaceAll("{{location}}", escapeHtml(personal.location || ""))
        .replaceAll("{{profileImage}}", profileImageForHTML)
        .replaceAll("{{shortIntro}}", escapeHtml(portfolio.shortIntro || ""))
        .replaceAll("{{about}}", escapeHtml(portfolio.about || ""))
        .replaceAll("{{skills}}", generateSkillsHTML(portfolio.skills || []))
        .replaceAll("{{education}}", generateEducationHTML(portfolio.education || []))
        .replaceAll("{{experience}}", generateExperienceHTML(portfolio.experience || []))
        .replaceAll("{{projects}}", generateProjectsHTML(portfolio.projects || []))
        .replaceAll("{{github}}", escapeHtml(safeExternalUrl(social.github)))
        .replaceAll("{{linkedin}}", escapeHtml(safeExternalUrl(social.linkedin)))
        .replaceAll("{{twitter}}", escapeHtml(safeExternalUrl(social.twitter)))
        .replaceAll("{{resume}}", resumeAvailable ? "assets/resume.pdf" : "#");
};


// ==================================================
// GENERATE PORTFOLIO
// ==================================================

const generatePortfolio = async (
    portfolioId,
    userId,
    requiredState = {},
    requiredDownloadVersion = null
) => {


    // ----------------------------------------------
    // Find portfolio
    // ----------------------------------------------

    const portfolioFilter = { _id: portfolioId, user: userId, ...requiredState };
    if (requiredDownloadVersion) {
        const { contentVersion, paidDownloadVersion } = requiredDownloadVersion;
        portfolioFilter.$and = [
            ...(Array.isArray(portfolioFilter.$and) ? portfolioFilter.$and : []),
            {
                $or: [
                    { contentVersion },
                    { contentVersion: { $exists: false } },
                    { contentVersion: null }
                ]
            },
            {
                $or: [
                    { paidDownloadVersion },
                    { paidDownloadVersion: { $exists: false } },
                    { paidDownloadVersion: null }
                ]
            }
        ];
    }
    const storedPortfolio = await Portfolio.findOne(portfolioFilter);


    if (!storedPortfolio) {
        const error = new Error("Portfolio not found");
        error.status = requiredDownloadVersion ? 409 : 404;
        error.code = requiredDownloadVersion ? "PORTFOLIO_CHANGED" : "PORTFOLIO_NOT_FOUND";
        throw error;

    }

    const portfolio = normalizePortfolioForTemplate(storedPortfolio);


    // ----------------------------------------------
    // Find template
    // ----------------------------------------------

    const template =
        await Template.findById(
            portfolio.template
        );


    if (
        !template ||
        !template.isActive
    ) {
        const error = new Error("Template not found");
        error.status = 404;
        error.code = "TEMPLATE_NOT_FOUND";
        throw error;
    }


    // ----------------------------------------------
    // Template directory
    // ----------------------------------------------

    const templateFiles = readTemplateFiles(template.templatePath);
    const htmlTemplate = templateFiles["index.html"];
    const css = templateFiles["style.css"];
    const js = templateFiles["script.js"];


    // =================================================
    // PROFILE IMAGE PATH
    // =================================================

    let profileImagePath = null;


    if (
        portfolio.personal?.profileImage
    ) {

        profileImagePath = await resolvePortfolioAssetPath(portfolio.personal.profileImage, "profileImage");

        if (!profileImagePath || ![".jpg", ".jpeg", ".png", ".webp"].includes(path.extname(profileImagePath).toLowerCase())) {
            profileImagePath = null;
        }


        if (
            (!profileImagePath || !fs.existsSync(
                profileImagePath
            ))
        ) {

            console.warn(
                "Profile image not found:",
                profileImagePath
            );


            profileImagePath = null;

        }

    }


    // =================================================
    // RESUME PATH
    // =================================================

    let resumePath = null;


    if (
        portfolio.resume
    ) {

        resumePath = await resolvePortfolioAssetPath(portfolio.resume, "resume");

        if (!resumePath || path.extname(resumePath).toLowerCase() !== ".pdf") {
            resumePath = null;
        }


        if (
            (!resumePath || !fs.existsSync(
                resumePath
            ))
        ) {

            console.warn(
                "Resume not found:",
                resumePath
            );


            resumePath = null;

        }

    }

    const profileImageExtension = profileImagePath
        ? path.extname(profileImagePath).toLowerCase()
        : "";
    const imageAsset = /^\.[a-z\d]+$/i.test(profileImageExtension)
        ? `assets/profile-image${profileImageExtension}`
        : "";

    const html = applyPortfolioSettings(
        replacePlaceholders(htmlTemplate, portfolio, Boolean(profileImagePath), Boolean(resumePath)),
        portfolio,
        imageAsset
    );

    const customizedCss = `${css}${buildCustomizationCss(portfolio)}`;


    // ----------------------------------------------
    // Return generated portfolio
    // ----------------------------------------------

    return {

        html,

        css: customizedCss,

        js,

        template,

        profileImagePath,

        resumePath

    };

};


// ==================================================
// EXPORT
// ==================================================

const preparePreviewHtml = (result, { inlineAssets = false } = {}) => {
    let html = result.html;
    const cssTag = `<style>${result.css}</style>`;
    const jsTag = `<script>${result.js}</script>`;
    html = html.replace(/<link\b[^>]*href=["']style\.css["'][^>]*>/i, cssTag);
    html = html.replace(/<script\b[^>]*src=["']script\.js["'][^>]*><\/script>/i, jsTag);
    if (inlineAssets && result.profileImagePath) {
        const extension = path.extname(result.profileImagePath).toLowerCase();
        const mime = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[extension];
        if (mime) {
            const dataUrl = `data:${mime};base64,${fs.readFileSync(result.profileImagePath).toString("base64")}`;
            html = html.replaceAll(`assets/profile-image${extension}`, dataUrl);
        }
    }
    if (inlineAssets && result.resumePath) {
        const dataUrl = `data:application/pdf;base64,${fs.readFileSync(result.resumePath).toString("base64")}`;
        html = html.replaceAll("assets/resume.pdf", dataUrl);
    }
    return html;
};

module.exports = {
    generatePortfolio,
    preparePreviewHtml,
    resolvePortfolioAssetPath,
    readTemplateFiles,
    normalizePortfolioForTemplate,
    supportedSections,
    fontFamilies,
    templateContract
};
