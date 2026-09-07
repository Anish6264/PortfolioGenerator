const express = require("express");

const {
    getTemplates,
    getTemplateById
} = require("../controllers/template.controller");

const router = express.Router();

router.get("/", getTemplates);
router.get("/:id", getTemplateById);

module.exports = router;