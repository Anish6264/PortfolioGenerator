const fs = require("fs");
const path = require("path");

const Portfolio = require("../models/Portfolio");
const Template = require("../models/Template");


// ==================================================
// SKILLS HTML
// ==================================================

const generateSkillsHTML = (skills) => {

    return skills
        .map((skill) => {

            return `
                <span class="skill">
                    ${skill}
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
                        ${item.degree || ""}
                    </h3>

                    <h4>
                        ${item.institution || ""}
                    </h4>

                    <p>
                        ${item.field || ""}
                    </p>

                    <p>
                        ${item.startYear || ""}
                        -
                        ${item.endYear || ""}
                    </p>

                    ${
                        item.description
                            ? `
                                <p>
                                    ${item.description}
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
                        ${item.role || ""}
                    </h3>

                    <h4>
                        ${item.company || ""}
                    </h4>

                    <p>
                        ${item.startDate || ""}
                        -
                        ${item.endDate || "Present"}
                    </p>

                    ${
                        item.description
                            ? `
                                <p>
                                    ${item.description}
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
                                ${technology}
                            </span>
                        `;

                    })
                    .join("\n");


            // --------------------------------------
            // Project Links
            // --------------------------------------

            const liveLink =
                project.liveUrl
                    ? `
                        <a
                            href="${project.liveUrl}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Live Demo
                        </a>
                    `
                    : "";


            const githubLink =
                project.githubUrl
                    ? `
                        <a
                            href="${project.githubUrl}"
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
                        ${project.title || ""}
                    </h3>


                    <p>
                        ${project.description || ""}
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

const replacePlaceholders = (
    html,
    portfolio
) => {

    const personal =
        portfolio.personal || {};

    const social =
        portfolio.social || {};


    // ----------------------------------------------
    // Profile image path for generated portfolio
    // ----------------------------------------------

    let profileImageForHTML = "";


    if (
        personal.profileImage
    ) {

        const extension =
            path.extname(
                personal.profileImage
            );


        profileImageForHTML =
            `assets/profile-image${extension}`;

    }


    return html

        // ------------------------------------------
        // Personal
        // ------------------------------------------

        .replaceAll(
            "{{name}}",
            personal.name || ""
        )

        .replaceAll(
            "{{title}}",
            personal.title || ""
        )

        .replaceAll(
            "{{email}}",
            personal.email || ""
        )

        .replaceAll(
            "{{phone}}",
            personal.phone || ""
        )

        .replaceAll(
            "{{location}}",
            personal.location || ""
        )

        .replaceAll(
            "{{profileImage}}",
            profileImageForHTML
        )


        // ------------------------------------------
        // Introduction
        // ------------------------------------------

        .replaceAll(
            "{{shortIntro}}",
            portfolio.shortIntro || ""
        )

        .replaceAll(
            "{{about}}",
            portfolio.about || ""
        )


        // ------------------------------------------
        // Skills
        // ------------------------------------------

        .replaceAll(
            "{{skills}}",
            generateSkillsHTML(
                portfolio.skills || []
            )
        )


        // ------------------------------------------
        // Education
        // ------------------------------------------

        .replaceAll(
            "{{education}}",
            generateEducationHTML(
                portfolio.education || []
            )
        )


        // ------------------------------------------
        // Experience
        // ------------------------------------------

        .replaceAll(
            "{{experience}}",
            generateExperienceHTML(
                portfolio.experience || []
            )
        )


        // ------------------------------------------
        // Projects
        // ------------------------------------------

        .replaceAll(
            "{{projects}}",
            generateProjectsHTML(
                portfolio.projects || []
            )
        )


        // ------------------------------------------
        // Social
        // ------------------------------------------

        .replaceAll(
            "{{github}}",
            social.github || ""
        )

        .replaceAll(
            "{{linkedin}}",
            social.linkedin || ""
        )

        .replaceAll(
            "{{twitter}}",
            social.twitter || ""
        )

        .replaceAll(
    "{{resume}}",
    portfolio.resume
        ? "assets/resume.pdf"
        : "#"
);

};


// ==================================================
// GENERATE PORTFOLIO
// ==================================================

const generatePortfolio = async (
    portfolioId,
    userId
) => {


    // ----------------------------------------------
    // Find portfolio
    // ----------------------------------------------

    const portfolio =
        await Portfolio.findOne({

            _id: portfolioId,

            user: userId

        });


    if (!portfolio) {

        throw new Error(
            "Portfolio not found"
        );

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


    // ----------------------------------------------
    // Replace placeholders
    // ----------------------------------------------

    const html =
        replacePlaceholders(
            htmlTemplate,
            portfolio
        );


    // =================================================
    // PROFILE IMAGE PATH
    // =================================================

    let profileImagePath = null;


    if (
        portfolio.personal?.profileImage
    ) {

        profileImagePath =
            path.join(

                __dirname,

                "..",

                portfolio.personal.profileImage

            );


        if (
            !fs.existsSync(
                profileImagePath
            )
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

        resumePath =
            path.join(

                __dirname,

                "..",

                portfolio.resume

            );


        if (
            !fs.existsSync(
                resumePath
            )
        ) {

            console.warn(
                "Resume not found:",
                resumePath
            );


            resumePath = null;

        }

    }


    // ----------------------------------------------
    // Return generated portfolio
    // ----------------------------------------------

    return {

        html,

        css,

        js,

        template,

        profileImagePath,

        resumePath

    };

};


// ==================================================
// EXPORT
// ==================================================

module.exports = {

    generatePortfolio

};