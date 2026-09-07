const Template = require("../models/Template");

const getTemplates = async (req, res) => {
    try {
        const templates = await Template.find({
            isActive: true
        }).sort({
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

module.exports = {
    getTemplates,
    getTemplateById
};