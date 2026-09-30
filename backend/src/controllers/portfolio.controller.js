const Portfolio = require("../models/Portfolio");
const {
    createPortfolioWithUniqueSlug,
    updatePortfolioWithUniqueSlug
} = require("../utils/portfolioSlug");

const editablePortfolioFields = [
    "template",
    "personal",
    "shortIntro",
    "about",
    "skills",
    "education",
    "experience",
    "projects",
    "social",
    "resume",
    "primaryColor",
    "secondaryColor",
    "backgroundColor",
    "textColor",
    "fontFamily",
    "sectionVisibility",
    "sectionOrder",
    "customSections",
    "seoTitle",
    "seoDescription"
];

const supportedSections = [
    "about",
    "education",
    "experience",
    "skills",
    "projects",
    "contact"
];

const supportedFonts = [
    "Arial",
    "Inter",
    "Poppins",
    "Roboto",
    "Open Sans",
    "Merriweather"
];

const isValidColor = (value) =>
    typeof value === "string" && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value);

const isObject = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value);

const trimStrings = (value) => {
    if (typeof value === "string") {
        return value.trim();
    }

    if (Array.isArray(value)) {
        return value.map(trimStrings);
    }

    if (isObject(value)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, nestedValue]) => [key, trimStrings(nestedValue)])
        );
    }

    return value;
};

const clonePortfolioContent = (value) => {
    if (Array.isArray(value)) {
        return value.map(clonePortfolioContent);
    }

    const plainValue =
        value && typeof value.toObject === "function"
            ? value.toObject({ depopulate: true })
            : value;

    if (plainValue && typeof plainValue === "object") {
        return Object.fromEntries(
            Object.entries(plainValue)
                .filter(([key]) =>
                    !["_id", "createdAt", "updatedAt", "__v", "user"].includes(key)
                )
                .map(([key, nestedValue]) => [key, clonePortfolioContent(nestedValue)])
        );
    }

    return plainValue;
};

const validatePortfolioData = (data, partial = false) => {
    if (!isObject(data)) {
        return "Portfolio data must be an object";
    }

    if (!partial && (typeof data.template !== "string" || !data.template.trim())) {
        return "template is required";
    }
    if (
        partial &&
        Object.prototype.hasOwnProperty.call(data, "template") &&
        typeof data.template === "string" &&
        !data.template.trim()
    ) {
        return "template is required";
    }

    if (!partial && !isObject(data.personal)) {
        return "personal must be an object";
    }

    for (const field of ["skills", "education", "experience", "projects"]) {
        if (Object.prototype.hasOwnProperty.call(data, field) && !Array.isArray(data[field])) {
            return `${field} must be an array`;
        }
    }

    for (const field of ["personal", "social"]) {
        if (
            Object.prototype.hasOwnProperty.call(data, field) &&
            !isObject(data[field])
        ) {
            return `${field} must be an object`;
        }
    }

    if (isObject(data.personal)) {
        for (const field of ["name", "title", "email", "phone", "location", "profileImage"]) {
            if (
                Object.prototype.hasOwnProperty.call(data.personal, field) &&
                typeof data.personal[field] !== "string"
            ) {
                return `personal.${field} must be a string`;
            }
        }

        if (!partial) {
            for (const field of ["name", "title", "email"]) {
                if (typeof data.personal[field] !== "string" || !data.personal[field].trim()) {
                    return `personal.${field} is required`;
                }
            }
        }

        if (partial) {
            for (const field of ["name", "title", "email"]) {
                if (
                    Object.prototype.hasOwnProperty.call(data.personal, field) &&
                    !data.personal[field].trim()
                ) {
                    return `personal.${field} is required`;
                }
            }
        }

        if (
            typeof data.personal.email === "string" &&
            data.personal.email.trim() &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.personal.email.trim())
        ) {
            return "personal.email must be a valid email address";
        }
    }

    if (!partial && (typeof data.personal.email !== "string" || !data.personal.email.trim())) {
        return "personal.email is required";
    }

    for (const field of ["template", "shortIntro", "about", "resume"]) {
        if (
            Object.prototype.hasOwnProperty.call(data, field) &&
            (typeof data[field] !== "string" || (field === "template" && !data[field].trim()))
        ) {
            return `${field} must be a string`;
        }
    }

    for (const field of ["primaryColor", "secondaryColor", "backgroundColor", "textColor"]) {
        if (
            Object.prototype.hasOwnProperty.call(data, field) &&
            !isValidColor(data[field])
        ) {
            return `${field} must be a valid hex color`;
        }
    }

    if (
        Object.prototype.hasOwnProperty.call(data, "fontFamily") &&
        !supportedFonts.includes(data.fontFamily)
    ) {
        return "fontFamily is not supported";
    }

    if (Object.prototype.hasOwnProperty.call(data, "sectionVisibility")) {
        if (!isObject(data.sectionVisibility)) {
            return "sectionVisibility must be an object";
        }

        for (const [section, visible] of Object.entries(data.sectionVisibility)) {
            if (!supportedSections.includes(section) || typeof visible !== "boolean") {
                return "sectionVisibility contains an invalid section";
            }
        }
    }

    if (Object.prototype.hasOwnProperty.call(data, "sectionOrder")) {
        if (
            !Array.isArray(data.sectionOrder) ||
            data.sectionOrder.length > supportedSections.length ||
            data.sectionOrder.some((section) => !supportedSections.includes(section)) ||
            new Set(data.sectionOrder).size !== data.sectionOrder.length
        ) {
            return "sectionOrder contains invalid or duplicate sections";
        }
    }

    if (Object.prototype.hasOwnProperty.call(data, "customSections")) {
        if (!Array.isArray(data.customSections) || data.customSections.length > 10) {
            return "customSections must be an array of at most 10 sections";
        }

        for (const section of data.customSections) {
            if (
                !isObject(section) ||
                Object.keys(section).some((key) => !["title", "content"].includes(key)) ||
                typeof section.title !== "string" ||
                !section.title.trim() ||
                section.title.length > 80 ||
                typeof section.content !== "string" ||
                section.content.length > 4000
            ) {
                return "Each custom section needs a title and content within the allowed limits";
            }
        }
    }

    if (
        Object.prototype.hasOwnProperty.call(data, "seoTitle") &&
        (typeof data.seoTitle !== "string" || data.seoTitle.length > 70)
    ) {
        return "seoTitle must be 70 characters or fewer";
    }

    if (
        Object.prototype.hasOwnProperty.call(data, "seoDescription") &&
        (typeof data.seoDescription !== "string" || data.seoDescription.length > 200)
    ) {
        return "seoDescription must be 200 characters or fewer";
    }

    return null;
};

const isValidPortfolioId = (id) => /^[a-f\d]{24}$/i.test(id || "");

const sendPortfolioError = (res, error, operation) => {
    console.error(`${operation} error:`, error);

    if (error.name === "ValidationError" || error.name === "CastError") {
        return res.status(400).json({
            message: "Invalid portfolio data"
        });
    }

    if (error.code === 11000) {
        return res.status(409).json({ message: "Portfolio slug already exists" });
    }

    return res.status(500).json({
        message: "Server error"
    });
};

const createPortfolio = async (req, res) => {
    try {
        const portfolioData = trimStrings(req.body || {});
        const validationError = validatePortfolioData(portfolioData);

        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const portfolio = await createPortfolioWithUniqueSlug(Portfolio, {
            ...portfolioData,
            status: "draft",
            user: req.user.id
        }, portfolioData.personal.name || portfolioData.personal.title);

        return res.status(201).json({
            message: "Portfolio created successfully",
            portfolio
        });
    } catch (error) {
        return sendPortfolioError(res, error, "Create portfolio");
    }
};

const getMyPortfolios = async (req, res) => {
    try {
        const portfolios = await Portfolio.find({
            user: req.user.id
        }).populate("template", "name category");

        return res.status(200).json({
            portfolios
        });
    } catch (error) {
        console.error("Get portfolios error:", error);

        return res.status(500).json({
            message: "Server error"
        });
    }
};

const getPortfolioById = async (req, res) => {
    try {
        if (!isValidPortfolioId(req.params.id)) {
            return res.status(400).json({ message: "Invalid portfolio ID" });
        }

        const portfolio = await Portfolio.findOne({
            _id: req.params.id,
            user: req.user.id
        }).populate("template");

        if (!portfolio) {
            return res.status(404).json({
                message: "Portfolio not found"
            });
        }

        return res.status(200).json({
            portfolio
        });
    } catch (error) {
        console.error("Get portfolio error:", error);

        return res.status(500).json({
            message: "Server error"
        });
    }
};

const updatePortfolio = async (req, res) => {
    try {
        if (!isValidPortfolioId(req.params.id)) {
            return res.status(400).json({ message: "Invalid portfolio ID" });
        }

        const updates = Object.fromEntries(
            editablePortfolioFields
                .filter((field) =>
                    Object.prototype.hasOwnProperty.call(req.body || {}, field)
                )
                .map((field) => [field, req.body[field]])
        );

        const normalizedUpdates = trimStrings(updates);
        const validationError = validatePortfolioData(normalizedUpdates, true);

        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const portfolio = await Portfolio.findOneAndUpdate(
            {
                _id: req.params.id,
                user: req.user.id
            },
            normalizedUpdates,
            {
                new: true,
                runValidators: true
            }
        );

        if (!portfolio) {
            return res.status(404).json({
                message: "Portfolio not found"
            });
        }

        return res.status(200).json({
            message: "Portfolio updated successfully",
            portfolio
        });
    } catch (error) {
        return sendPortfolioError(res, error, "Update portfolio");
    }
};

const duplicatePortfolio = async (req, res) => {
    try {
        if (!isValidPortfolioId(req.params.id)) {
            return res.status(400).json({ message: "Invalid portfolio ID" });
        }

        const source = await Portfolio.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!source) {
            return res.status(404).json({
                message: "Portfolio not found"
            });
        }

        const duplicateData = {
            user: req.user.id,
            template: source.template,
            personal: clonePortfolioContent(source.personal),
            shortIntro: source.shortIntro,
            about: source.about,
            skills: clonePortfolioContent(source.skills),
            education: clonePortfolioContent(source.education),
            experience: clonePortfolioContent(source.experience),
            projects: clonePortfolioContent(source.projects),
            social: clonePortfolioContent(source.social),
            resume: source.resume,
            primaryColor: source.primaryColor,
            secondaryColor: source.secondaryColor,
            backgroundColor: source.backgroundColor,
            textColor: source.textColor,
            fontFamily: source.fontFamily,
            sectionVisibility: clonePortfolioContent(source.sectionVisibility),
            sectionOrder: source.sectionOrder,
            customSections: clonePortfolioContent(source.customSections),
            seoTitle: source.seoTitle,
            seoDescription: source.seoDescription,
            status: "draft"
        };
        const duplicate = await createPortfolioWithUniqueSlug(
            Portfolio,
            duplicateData,
            source.personal?.name || source.personal?.title
        );
        await duplicate.populate("template", "name category");

        return res.status(201).json({
            message: "Portfolio duplicated successfully",
            portfolio: duplicate
        });
    } catch (error) {
        return sendPortfolioError(res, error, "Duplicate portfolio");
    }
};

const updatePortfolioStatus = async (req, res) => {
    try {
        if (!isValidPortfolioId(req.params.id)) {
            return res.status(400).json({ message: "Invalid portfolio ID" });
        }

        const { status } = req.body || {};
        if (status !== "draft" && status !== "published") {
            return res.status(400).json({
                message: "Status must be draft or published"
            });
        }

        const filter = { _id: req.params.id, user: req.user.id };
        const existing = await Portfolio.findOne(filter);
        if (!existing) {
            return res.status(404).json({ message: "Portfolio not found" });
        }

        const portfolio = status === "published" && !existing.slug
            ? await updatePortfolioWithUniqueSlug(
                Portfolio,
                filter,
                { status },
                existing.personal?.name || existing.personal?.title
            )
            : await Portfolio.findOneAndUpdate(
                filter,
                { status },
                { new: true, runValidators: true }
            );

        if (!portfolio) {
            return res.status(404).json({
                message: "Portfolio not found"
            });
        }

        await portfolio.populate("template", "name category");

        return res.status(200).json({
            message: "Portfolio status updated successfully",
            portfolio
        });
    } catch (error) {
        return sendPortfolioError(res, error, "Update portfolio status");
    }
};

const deletePortfolio = async (req, res) => {
    try {
        if (!isValidPortfolioId(req.params.id)) {
            return res.status(400).json({ message: "Invalid portfolio ID" });
        }

        const portfolio = await Portfolio.findOneAndDelete({
            _id: req.params.id,
            user: req.user.id
        });

        if (!portfolio) {
            return res.status(404).json({
                message: "Portfolio not found"
            });
        }

        return res.status(200).json({
            message: "Portfolio deleted successfully"
        });
    } catch (error) {
        console.error("Delete portfolio error:", error);

        return res.status(500).json({
            message: "Server error"
        });
    }
};

module.exports = {
    createPortfolio,
    getMyPortfolios,
    getPortfolioById,
    updatePortfolio,
    duplicatePortfolio,
    updatePortfolioStatus,
    deletePortfolio
};
