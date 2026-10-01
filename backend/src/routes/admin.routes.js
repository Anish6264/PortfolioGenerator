const express = require("express");

const protect = require("../middleware/auth.middleware");
const requireAdmin = require("../middleware/admin.middleware");
const {
    getAdminTemplates,
    getAdminTemplate,
    updateAdminTemplate
} = require("../controllers/adminTemplate.controller");

const router = express.Router();

router.use(protect, requireAdmin);
router.get("/templates", getAdminTemplates);
router.get("/templates/:id", getAdminTemplate);
router.put("/templates/:id", updateAdminTemplate);

module.exports = router;
