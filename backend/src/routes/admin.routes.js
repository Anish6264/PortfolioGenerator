const express = require("express");

const protect = require("../middleware/auth.middleware");
const requireAdmin = require("../middleware/admin.middleware");
const {
    getAdminTemplates,
    getAdminTemplate,
    updateAdminTemplate
} = require("../controllers/adminTemplate.controller");
const { getAdminDashboard } = require("../controllers/adminDashboard.controller");
const { listAdminUsers, getAdminUserDetails } = require("../controllers/adminUser.controller");
const { listAdminPayments, getAdminPaymentDetails } = require("../controllers/adminPayment.controller");
const { listAdminCreditTransactions, getAdminCreditTransactionDetails } = require("../controllers/adminCreditTransaction.controller");
const { listAdminPortfolios, getAdminPortfolioDetails } = require("../controllers/adminPortfolio.controller");

const router = express.Router();

router.use(protect, requireAdmin);
router.get("/dashboard", getAdminDashboard);
router.get("/users", listAdminUsers);
router.get("/users/:id", getAdminUserDetails);
router.get("/payments", listAdminPayments);
router.get("/payments/:id", getAdminPaymentDetails);
router.get("/credit-transactions", listAdminCreditTransactions);
router.get("/credit-transactions/:id", getAdminCreditTransactionDetails);
router.get("/portfolios", listAdminPortfolios);
router.get("/portfolios/:id", getAdminPortfolioDetails);
router.get("/templates", getAdminTemplates);
router.get("/templates/:id", getAdminTemplate);
router.put("/templates/:id", updateAdminTemplate);

module.exports = router;
