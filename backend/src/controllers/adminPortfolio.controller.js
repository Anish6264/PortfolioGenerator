const mongoose = require("mongoose");
const Portfolio = require("../models/Portfolio");
const Template = require("../models/Template");
const User = require("../models/User");
const CreditTransaction = require("../models/CreditTransaction");

const PAGE_SIZE_MAX = 50;
const PAGE_SIZE_DEFAULT = 20;
const allowedQuery = new Set(["page", "limit", "search", "status", "template", "category"]);
const statuses = Portfolio.schema.path("status").enumValues;
const categories = Template.schema.path("category").enumValues;

const escapeRegex = (value) => {
    const special = ".*+?^" + String.fromCharCode(36) + "{}()|[]\\";
    return Array.from(value).map((character) => special.includes(character) ? "\\" + character : character).join("");
};

const isObjectId = (value) => /^[a-f\d]{24}$/i.test(value || "") && mongoose.isValidObjectId(value);

const serializePortfolioSummary = (portfolio) => ({
    id: String(portfolio._id),
    name: portfolio.personal?.name || "",
    title: portfolio.personal?.title || "",
    owner: portfolio.user ? {
        id: String(portfolio.user._id),
        name: portfolio.user.name,
        email: portfolio.user.email
    } : null,
    template: portfolio.template ? {
        id: String(portfolio.template._id),
        name: portfolio.template.name,
        category: portfolio.template.category,
        isPremium: portfolio.template.isPremium,
        creditCost: portfolio.template.creditCost
    } : null,
    status: portfolio.status,
    createdAt: portfolio.createdAt,
    updatedAt: portfolio.updatedAt
});

const listAdminPortfolios = async (req, res) => {
    const query = req.query || {};
    if (Object.keys(query).some((key) => !allowedQuery.has(key))) {
        return res.status(400).json({ message: "Unsupported portfolio filter" });
    }

    const rawPage = query.page === undefined ? "1" : query.page;
    const rawLimit = query.limit === undefined ? String(PAGE_SIZE_DEFAULT) : query.limit;
    const page = Number(rawPage);
    const limit = Number(rawLimit);
    const status = query.status === undefined || query.status === "all" ? "" : query.status;
    const category = query.category === undefined || query.category === "all" ? "" : query.category;
    const templateId = query.template === undefined || query.template === "all" ? "" : query.template;
    const search = typeof query.search === "string" ? query.search.trim() : "";

    if (
        typeof rawPage !== "string" || !/^\d+$/.test(rawPage) || !Number.isSafeInteger(page) || page < 1 ||
        typeof rawLimit !== "string" || !/^\d+$/.test(rawLimit) || !Number.isSafeInteger(limit) || limit < 1 || limit > PAGE_SIZE_MAX ||
        !Number.isSafeInteger((page - 1) * limit) ||
        (query.status !== undefined && typeof query.status !== "string") || (status && !statuses.includes(status)) ||
        (query.category !== undefined && typeof query.category !== "string") || (category && !categories.includes(category)) ||
        (query.template !== undefined && typeof query.template !== "string") || (templateId && !isObjectId(templateId)) ||
        (query.search !== undefined && typeof query.search !== "string") || search.length > 100
    ) {
        return res.status(400).json({ message: "Invalid portfolio filter" });
    }

    const filter = {};
    if (status) filter.status = status;

    try {
        if (templateId || category) {
            const templateFilter = {};
            if (templateId) templateFilter._id = new mongoose.Types.ObjectId(templateId);
            if (category) templateFilter.category = category;
            const matchingTemplateIds = await Template.find(templateFilter).distinct("_id");
            if (!matchingTemplateIds.length) {
                return res.status(200).json({
                    portfolios: [],
                    pagination: { page, limit, total: 0, totalPages: 0 },
                    filters: { statuses, categories }
                });
            }
            filter.template = { $in: matchingTemplateIds };
        }

        if (search) {
            const expression = new RegExp(escapeRegex(search), "i");
            const matchingUserIds = await User.find({ $or: [{ name: expression }, { email: expression }] }).distinct("_id");
            const searchConditions = [{ "personal.name": expression }, { "personal.title": expression }];
            if (matchingUserIds.length) searchConditions.push({ user: { $in: matchingUserIds } });
            filter.$or = searchConditions;
        }

        const [portfolios, total] = await Promise.all([
            Portfolio.find(filter)
                .select("personal.name personal.title user template status createdAt updatedAt")
                .populate("user", "name email")
                .populate("template", "name category isPremium creditCost")
                .sort({ createdAt: -1, _id: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Portfolio.countDocuments(filter)
        ]);

        return res.status(200).json({
            portfolios: portfolios.map(serializePortfolioSummary),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            filters: { statuses, categories }
        });
    } catch (error) {
        console.error("Admin portfolio list failed:", error.name || "ADMIN_PORTFOLIO_LIST_ERROR");
        return res.status(500).json({ message: "Unable to load portfolios" });
    }
};

const getAdminPortfolioDetails = async (req, res) => {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ message: "Invalid portfolio ID" });

    try {
        const portfolioId = new mongoose.Types.ObjectId(id);
        const [portfolio] = await Portfolio.aggregate([
            { $match: { _id: portfolioId } },
            {
                $lookup: {
                    from: User.collection.name,
                    localField: "user",
                    foreignField: "_id",
                    pipeline: [{ $project: { name: 1, email: 1 } }],
                    as: "owner"
                }
            },
            { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: Template.collection.name,
                    localField: "template",
                    foreignField: "_id",
                    pipeline: [{ $project: { name: 1, category: 1, isPremium: 1, creditCost: 1 } }],
                    as: "templateSummary"
                }
            },
            { $unwind: { path: "$templateSummary", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    status: 1,
                    slug: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    owner: { id: "$owner._id", name: "$owner.name", email: "$owner.email" },
                    template: {
                        id: "$templateSummary._id",
                        name: "$templateSummary.name",
                        category: "$templateSummary.category",
                        isPremium: "$templateSummary.isPremium",
                        creditCost: "$templateSummary.creditCost"
                    },
                    portfolioSummary: {
                        name: { $ifNull: ["$personal.name", ""] },
                        title: { $ifNull: ["$personal.title", ""] },
                        email: { $ifNull: ["$personal.email", ""] },
                        shortIntro: { $substrCP: [{ $ifNull: ["$shortIntro", ""] }, 0, 300] },
                        about: { $substrCP: [{ $ifNull: ["$about", ""] }, 0, 300] }
                    },
                    contentCounts: {
                        skills: { $cond: [{ $isArray: "$skills" }, { $size: "$skills" }, 0] },
                        education: { $cond: [{ $isArray: "$education" }, { $size: "$education" }, 0] },
                        experience: { $cond: [{ $isArray: "$experience" }, { $size: "$experience" }, 0] },
                        projects: { $cond: [{ $isArray: "$projects" }, { $size: "$projects" }, 0] },
                        customSections: { $cond: [{ $isArray: "$customSections" }, { $size: "$customSections" }, 0] }
                    },
                    customization: {
                        fontFamily: "$fontFamily",
                        colors: {
                            primary: "$primaryColor",
                            secondary: "$secondaryColor",
                            background: "$backgroundColor",
                            text: "$textColor"
                        },
                        sectionVisibility: "$sectionVisibility",
                        sectionOrder: "$sectionOrder"
                    },
                    contentVersion: 1,
                    paidDownloadVersion: { $ifNull: ["$paidDownloadVersion", 0] },
                    normalizedContentVersion: { $ifNull: ["$contentVersion", 1] }
                }
            }
        ]);

        if (!portfolio) return res.status(404).json({ message: "Portfolio not found" });

        const contentVersion = Number.isInteger(portfolio.normalizedContentVersion) && portfolio.normalizedContentVersion >= 1
            ? portfolio.normalizedContentVersion
            : 1;
        const paidDownloadVersion = Number.isInteger(portfolio.paidDownloadVersion)
            ? portfolio.paidDownloadVersion
            : 0;
        const downloadPaid = paidDownloadVersion === contentVersion;
        const slug = portfolio.status === "published" && typeof portfolio.slug === "string" ? portfolio.slug : "";
        const creditActivity = await CreditTransaction.find({
            portfolio: portfolioId,
            type: { $in: ["DOWNLOAD", "REFUND"] }
        })
            .select("type direction amount balanceBefore balanceAfter status createdAt")
            .sort({ createdAt: -1, _id: -1 })
            .limit(10)
            .lean();

        return res.status(200).json({
            portfolio: {
                id: String(portfolio._id),
                status: portfolio.status,
                createdAt: portfolio.createdAt,
                updatedAt: portfolio.updatedAt,
                publicUrl: slug ? `/p/${encodeURIComponent(slug)}` : null,
                owner: portfolio.owner?.id ? {
                    id: String(portfolio.owner.id),
                    name: portfolio.owner.name,
                    email: portfolio.owner.email
                } : null,
                template: portfolio.template?.id ? {
                    id: String(portfolio.template.id),
                    name: portfolio.template.name,
                    category: portfolio.template.category,
                    isPremium: portfolio.template.isPremium,
                    creditCost: portfolio.template.creditCost
                } : null,
                portfolioSummary: portfolio.portfolioSummary,
                contentCounts: portfolio.contentCounts,
                customization: portfolio.customization,
                download: {
                    contentVersion,
                    paidDownloadVersion,
                    downloadPaid,
                    requiresPayment: !downloadPaid,
                    currentDownloadCost: portfolio.template?.creditCost ?? null
                },
                creditActivity: creditActivity.map((transaction) => ({
                    id: String(transaction._id),
                    type: transaction.type,
                    direction: transaction.direction,
                    amount: transaction.amount,
                    balanceBefore: transaction.balanceBefore,
                    balanceAfter: transaction.balanceAfter,
                    status: transaction.status,
                    createdAt: transaction.createdAt
                }))
            }
        });
    } catch (error) {
        console.error("Admin portfolio details failed:", error.name || "ADMIN_PORTFOLIO_DETAILS_ERROR");
        return res.status(500).json({ message: "Unable to load portfolio details" });
    }
};

module.exports = { listAdminPortfolios, getAdminPortfolioDetails };
