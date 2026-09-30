const fs = require("fs");
const path = require("path");

const Portfolio = require("../models/Portfolio");
const Template = require("../models/Template");

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

const resolvePortfolioAssetPath = (storedPath) => {
    if (typeof storedPath !== "string" || !storedPath.trim()) return null;
    const uploadRoot = path.resolve(__dirname, "../uploads");
    const resolved = path.resolve(__dirname, "..", storedPath);
    const relative = path.relative(uploadRoot, resolved);
    return relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
        ? resolved
        : null;
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
    let updatedHtml = hideSections(html, portfolio.sectionVisibility);
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
                        ${escapeHtml(item.field || "")}
                    </p>

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
        .map((project) => {


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
    requiredState = {}
) => {


    // ----------------------------------------------
    // Find portfolio
    // ----------------------------------------------

    const portfolio =
        await Portfolio.findOne({

            _id: portfolioId,

            user: userId,
            ...requiredState

        });


    if (!portfolio) {
        const error = new Error("Portfolio not found");
        error.status = 404;
        throw error;

    }


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

        throw new Error(
            "Template not found"
        );

    }


    // ----------------------------------------------
    // Template directory
    // ----------------------------------------------

    const templateDirectory =
        path.join(

            __dirname,

            "../templates",

            template.templatePath

        );


    if (
        !fs.existsSync(
            templateDirectory
        )
    ) {

        throw new Error(
            "Template files not found"
        );

    }


    // ----------------------------------------------
    // Template files
    // ----------------------------------------------

    const htmlPath =
        path.join(
            templateDirectory,
            "index.html"
        );


    const cssPath =
        path.join(
            templateDirectory,
            "style.css"
        );


    const jsPath =
        path.join(
            templateDirectory,
            "script.js"
        );


    // ----------------------------------------------
    // Read template files
    // ----------------------------------------------

    const htmlTemplate =
        fs.readFileSync(
            htmlPath,
            "utf-8"
        );


    const css =
        fs.readFileSync(
            cssPath,
            "utf-8"
        );


    const js =
        fs.readFileSync(
            jsPath,
            "utf-8"
        );


    // =================================================
    // PROFILE IMAGE PATH
    // =================================================

    let profileImagePath = null;


    if (
        portfolio.personal?.profileImage
    ) {

        profileImagePath = resolvePortfolioAssetPath(portfolio.personal.profileImage);

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

        resumePath = resolvePortfolioAssetPath(portfolio.resume);

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
    resolvePortfolioAssetPath
};
