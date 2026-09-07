const express = require("express");

const {
    getTemplates,
    getTemplateById,
    getTemplatePreview
} = require("../controllers/template.controller");

const router = express.Router();

router.get("/", getTemplates);
router.get("/:id", getTemplateById);
router.get("/:id/preview", getTemplatePreview);

module.exports = router;