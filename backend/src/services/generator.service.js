const fs = require("fs");
const path = require("path");

const Portfolio = require("../models/Portfolio");
const Template = require("../models/Template");

const generateSkillsHTML = (skills) => {
    return skills
        .map((skill) => {
            return `<span class="skill">${skill}</span>`;
        })
        .join("\n");
};

const generateProjectsHTML = (projects) => {
    return projects
        .map((project) => {
            return `
                <div class="project-card">
                    <h3>${project.title}</h3>

                    <p>
                        ${project.description}
                    </p>

                    <p>
                        ${project.technologies.join(", ")}
                    </p>

                    ${
                        project.liveUrl
                            ? `<a href="${project.liveUrl}" target="_blank">Live Demo</a>`
                            : ""
                    }

                    ${
                        project.githubUrl
                            ? `<a href="${project.githubUrl}" target="_blank">GitHub</a>`
                            : ""
                    }
                </div>
            `;
        })
        .join("\n");
};

const replacePlaceholders = (html, portfolio) => {
    const personal = portfolio.personal;
    const social = portfolio.social;

    return html
        .replaceAll("{{name}}", personal.name || "")
        .replaceAll("{{title}}", personal.title || "")
        .replaceAll("{{email}}", personal.email || "")
        .replaceAll("{{profileImage}}", personal.profileImage || "")
        .replaceAll("{{shortIntro}}", portfolio.shortIntro || "")
        .replaceAll("{{about}}", portfolio.about || "")
        .replaceAll(
            "{{skills}}",
            generateSkillsHTML(portfolio.skills || [])
        )
        .replaceAll(
            "{{projects}}",
            generateProjectsHTML(portfolio.projects || [])
        )
        .replaceAll("{{github}}", social.github || "")
        .replaceAll("{{linkedin}}", social.linkedin || "")
        .replaceAll("{{twitter}}", social.twitter || "");
};

const generatePortfolio = async (portfolioId, userId) => {

    const portfolio = await Portfolio.findOne({
        _id: portfolioId,
        user: userId
    });

    if (!portfolio) {
        throw new Error("Portfolio not found");
    }

    const template = await Template.findById(
        portfolio.template
    );

    if (!template || !template.isActive) {
        throw new Error("Template not found");
    }

    const templateDirectory = path.join(
        __dirname,
        "../templates",
        template.templatePath
    );

    if (!fs.existsSync(templateDirectory)) {
        throw new Error("Template files not found");
    }

    const htmlPath = path.join(
        templateDirectory,
        "index.html"
    );

    const cssPath = path.join(
        templateDirectory,
        "style.css"
    );

    const jsPath = path.join(
        templateDirectory,
        "script.js"
    );

    const htmlTemplate = fs.readFileSync(
        htmlPath,
        "utf-8"
    );

    const css = fs.readFileSync(
        cssPath,
        "utf-8"
    );

    const js = fs.readFileSync(
        jsPath,
        "utf-8"
    );

    const html = replacePlaceholders(
        htmlTemplate,
        portfolio
    );

    return {
        html,
        css,
        js,
        template
    };
};

module.exports = {
    generatePortfolio
};