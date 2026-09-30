const Template = require("../models/Template");
const { readTemplateFiles } = require("../services/generator.service");

const getTemplates = async (req, res) => {
    try {
        const filter = {
            isActive: true
        };
        const category = req.query.category || req.query.profession;

        if (category) {
            const supportedCategories =
                Template.schema.path("category").enumValues;

            if (!supportedCategories.includes(category)) {
                return res.status(400).json({
                    message: "Invalid template category"
                });
            }

            filter.category = category;
        }

        const templates = await Template.find(filter).sort({
            createdAt: -1
        });

        return res.status(200).json({
            templates
        });
    } catch (error) {
        console.error("Get templates error:", error.message);

        return res.status(500).json({
            message: "Server error"
        });
    }
};

const getTemplateById = async (req, res) => {
    try {
        const template = await Template.findById(req.params.id);

        if (!template || !template.isActive) {
            return res.status(404).json({
                message: "Template not found"
            });
        }

        return res.status(200).json({
            template
        });
    } catch (error) {
        console.error("Get template error:", error.message);

        return res.status(500).json({
            message: "Server error"
        });
    }
};

const getTemplatePreview = async (req, res) => {
    try {
        const template = await Template.findById(req.params.id);

        if (!template || !template.isActive) {
            return res.status(404).json({
                message: "Template not found"
            });
        }

        const { "index.html": html, "style.css": css, "script.js": js } = readTemplateFiles(template.templatePath);

        return res.status(200).json({
            html,
            css,
            js
        });

    } catch (error) {
        console.error("Template preview error:", error.code === "INVALID_TEMPLATE" ? "Template files are unavailable" : error.message);

        return res.status(500).json({
            message: "Template preview is unavailable"
        });
    }
};

module.exports = {
    getTemplates,
    getTemplateById,
    getTemplatePreview
};
