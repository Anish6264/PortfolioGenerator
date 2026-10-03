const Portfolio = require("../models/Portfolio");
const Template = require("../models/Template");
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

const editablePersonalFields = ["name", "title", "email", "phone", "location"];
const editableSocialFields = ["github", "linkedin", "twitter"];
const pickFields = (value, fields) => Object.fromEntries(
    fields.filter((field) => Object.prototype.hasOwnProperty.call(value, field))
        .map((field) => [field, value[field]])
);
const sanitizePortfolioPayload = (body) => {
    if (!isObject(body)) return body;
    const payload = pickFields(body, editablePortfolioFields);
    if (Object.prototype.hasOwnProperty.call(body, "personal")) {
        payload.personal = isObject(body.personal) ? pickFields(body.personal, editablePersonalFields) : body.personal;
    }
    if (Object.prototype.hasOwnProperty.call(body, "social")) {
        payload.social = isObject(body.social) ? pickFields(body.social, editableSocialFields) : body.social;
    }
    return payload;
};

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

const isSafeExternalUrl = (value) => {
    if (typeof value !== "string" || !value.trim()) return false;
    try {
        const parsed = new URL(value.trim());
        return ["http:", "https:"].includes(parsed.protocol) && Boolean(parsed.hostname) && !parsed.username && !parsed.password;
    } catch {
        return false;
    }
};

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

const serializeDownloadState = (portfolio) => {
    const value = portfolio?.toObject ? portfolio.toObject() : { ...portfolio };
    const contentVersion = Number.isInteger(value.contentVersion) && value.contentVersion >= 1 ? value.contentVersion : 1;
    const paidDownloadVersion = Number.isInteger(value.paidDownloadVersion) ? value.paidDownloadVersion : 0;
    return { ...value, contentVersion, paidDownloadVersion, downloadPaid: paidDownloadVersion === contentVersion };
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
        for (const field of ["name", "title", "email", "phone", "location", "profileImage", "profileImageOriginalName"]) {
            if (
                Object.prototype.hasOwnProperty.call(data.personal, field) &&
                typeof data.personal[field] !== "string"
            ) {
                return `personal.${field} must be a string`;
            }
        }

        if ((data.personal.profileImageOriginalName || "").length > 255) {
            return "personal.profileImageOriginalName must be 255 characters or fewer";
        }
        const personalLimits = { name: 100, title: 120, email: 254, phone: 100, location: 150, profileImage: 2048 };
        for (const [field, maxLength] of Object.entries(personalLimits)) {
            if (typeof data.personal[field] === "string" && data.personal[field].length > maxLength) {
                return `personal.${field} exceeds the allowed length`;
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

    if (Object.prototype.hasOwnProperty.call(data, "shortIntro") && data.shortIntro.length > 1000) {
        return "shortIntro must be 1000 characters or fewer";
    }
    if (Object.prototype.hasOwnProperty.call(data, "about") && data.about.length > 4000) {
        return "about must be 4000 characters or fewer";
    }

    if (Object.prototype.hasOwnProperty.call(data, "skills")) {
        if (data.skills.length > 100 || data.skills.some((item) => typeof item !== "string" || item.length > 100)) {
            return "skills must contain at most 100 text values of 100 characters or fewer";
        }
    }

    const rowFields = {
        education: { degree: 200, institution: 200, startYear: 30, endYear: 30, description: 2000 },
        experience: { company: 200, role: 200, startDate: 50, endDate: 50, description: 2000 },
        projects: { title: 120, description: 2000, liveUrl: 2048, githubUrl: 2048 }
    };
    for (const [field, allowedFields] of Object.entries(rowFields)) {
        if (!Object.prototype.hasOwnProperty.call(data, field)) continue;
        if (data[field].length > 50) return `${field} must contain at most 50 entries`;
        for (const row of data[field]) {
            if (!isObject(row) || Object.keys(row).some((key) => !Object.prototype.hasOwnProperty.call(allowedFields, key) && !(field === "projects" && key === "technologies"))) {
                return `${field} contains an unsupported entry`;
            }
            for (const [key, value] of Object.entries(row)) {
                if (field === "projects" && key === "technologies") {
                    if (!Array.isArray(value) || value.length > 30 || value.some((item) => typeof item !== "string" || item.length > 100)) {
                        return "Project technologies must contain at most 30 text values of 100 characters or fewer";
                    }
                    continue;
                }
                if (typeof value !== "string" || value.length > allowedFields[key]) {
                    return `Invalid ${field} field length`;
                }
                if (["liveUrl", "githubUrl"].includes(key) && value && !isSafeExternalUrl(value)) {
                    return `${field}.${key} must use HTTP or HTTPS`;
                }
            }
        }
    }

    if (Object.prototype.hasOwnProperty.call(data, "social")) {
        const socialFields = ["github", "linkedin", "twitter"];
        if (Object.keys(data.social).some((key) => !socialFields.includes(key))) return "social contains an unsupported field";
        for (const [key, value] of Object.entries(data.social)) {
            if (typeof value !== "string" || value.length > 2048 || (value && !isSafeExternalUrl(value))) {
                return `social.${key} must be an HTTP or HTTPS URL of 2048 characters or fewer`;
            }
        }
    }

    return null;
};

const isValidPortfolioId = (id) => /^[a-f\d]{24}$/i.test(id || "");

const sendPortfolioError = (res, error, operation) => {
    console.error(`${operation} error:`, error?.name || "PORTFOLIO_OPERATION_ERROR", error?.code || "UNKNOWN");

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
        const portfolioData = trimStrings(sanitizePortfolioPayload(req.body || {}));
        const validationError = validatePortfolioData(portfolioData);

        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const selectedTemplate = await Template.findById(portfolioData.template).select("isActive");
        if (!selectedTemplate || !selectedTemplate.isActive) {
            return res.status(404).json({
                code: "TEMPLATE_NOT_FOUND",
                message: "Template not found"
            });
        }

        const portfolio = await createPortfolioWithUniqueSlug(Portfolio, {
            ...portfolioData,
            downloadPaid: false,
            contentVersion: 1,
            paidDownloadVersion: 0,
            downloadReservation: null,
            status: "draft",
            user: req.user.id
        }, portfolioData.personal.name || portfolioData.personal.title);

        return res.status(201).json({
            message: "Portfolio created successfully",
            portfolio: serializeDownloadState(portfolio)
        });
    } catch (error) {
        return sendPortfolioError(res, error, "Create portfolio");
    }
};

const getMyPortfolios = async (req, res) => {
    try {
        const portfolios = await Portfolio.find({
            user: req.user.id
        }).populate("template", "name category isPremium creditCost");

        return res.status(200).json({
            portfolios: portfolios.map(serializeDownloadState)
        });
    } catch (error) {
        console.error("Get portfolios error:", error?.name || "PORTFOLIO_LIST_ERROR", error?.code || "UNKNOWN");

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
            portfolio: serializeDownloadState(portfolio)
        });
    } catch (error) {
        console.error("Get portfolio error:", error?.name || "PORTFOLIO_LOOKUP_ERROR", error?.code || "UNKNOWN");

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

        const existingPortfolio = await Portfolio.findOne({ _id: req.params.id, user: req.user.id })
            .select("+downloadReservation");
        if (!existingPortfolio) return res.status(404).json({ message: "Portfolio not found" });

        const normalizedUpdates = trimStrings(updates);
        if (Object.prototype.hasOwnProperty.call(normalizedUpdates, "personal")) {
            if (!isObject(normalizedUpdates.personal)) {
                return res.status(400).json({ message: "personal must be an object" });
            }
            const safePersonalUpdates = pickFields(normalizedUpdates.personal, editablePersonalFields);
            const existingPersonal = existingPortfolio.personal?.toObject?.() || existingPortfolio.personal || {};
            normalizedUpdates.personal = {
                ...existingPersonal,
                ...safePersonalUpdates,
                name: existingPortfolio.personal.name,
                email: existingPortfolio.personal.email,
                profileImage: existingPortfolio.personal.profileImage || "",
                profileImageOriginalName: existingPortfolio.personal.profileImageOriginalName || ""
            };
        }
        const validationError = validatePortfolioData(normalizedUpdates, true);

        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        let changesTemplate = false;
        if (Object.prototype.hasOwnProperty.call(normalizedUpdates, "template")) {
            const currentPortfolio = existingPortfolio;

            if (!currentPortfolio) {
                return res.status(404).json({ message: "Portfolio not found" });
            }

            if (String(currentPortfolio.template) !== normalizedUpdates.template) {
                changesTemplate = true;
                if (currentPortfolio.downloadReservation) {
                    return res.status(409).json({
                        code: "DOWNLOAD_IN_PROGRESS",
                        message: "The portfolio template cannot be changed during its first download. Please retry shortly."
                    });
                }
                const selectedTemplate = await Template.findById(normalizedUpdates.template).select("isActive");
                if (!selectedTemplate || !selectedTemplate.isActive) {
                    return res.status(404).json({
                        code: "TEMPLATE_NOT_FOUND",
                        message: "Template not found"
                    });
                }
            }
        }

        const contentChanged = Object.entries(normalizedUpdates).some(([key, value]) => {
            const current = existingPortfolio.get(key);
            return JSON.stringify(value) !== JSON.stringify(current);
        });
        if (existingPortfolio.downloadReservation && contentChanged) {
            return res.status(409).json({ code: "DOWNLOAD_IN_PROGRESS", message: "The portfolio cannot be changed while a download is in progress." });
        }
        const currentVersion = Number.isInteger(existingPortfolio.contentVersion) && existingPortfolio.contentVersion >= 1 ? existingPortfolio.contentVersion : 1;
        const updateFilter = {
            _id: req.params.id,
            user: req.user.id,
            downloadReservation: null,
            $or: [{ contentVersion: currentVersion }, { contentVersion: { $exists: false } }]
        };
        const portfolio = await Portfolio.findOneAndUpdate(
            updateFilter,
            {
                $set: {
                    ...normalizedUpdates,
                    ...(contentChanged ? { downloadPaid: false, contentVersion: currentVersion + 1 } : {})
                },
            },
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        if (!portfolio) {
            const current = await Portfolio.findOne({ _id: req.params.id, user: req.user.id }).select("+downloadReservation");
            if (current?.downloadReservation) {
                return res.status(409).json({ code: "DOWNLOAD_IN_PROGRESS", message: "The portfolio cannot be changed while a download is in progress." });
            }
            if (current) return res.status(409).json({ code: "PORTFOLIO_CHANGED", message: "The portfolio changed while saving. Please retry." });
            return res.status(404).json({
                message: "Portfolio not found"
            });
        }

        return res.status(200).json({
            message: "Portfolio updated successfully",
            portfolio: serializeDownloadState(portfolio)
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
            resumeOriginalName: source.resumeOriginalName,
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
            status: "draft",
            downloadPaid: false,
            contentVersion: 1,
            paidDownloadVersion: 0,
            downloadReservation: null
        };
        const duplicate = await createPortfolioWithUniqueSlug(
            Portfolio,
            duplicateData,
            source.personal?.name || source.personal?.title
        );
        await duplicate.populate("template", "name category");

        return res.status(201).json({
            message: "Portfolio duplicated successfully",
            portfolio: serializeDownloadState(duplicate)
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
                { returnDocument: "after", runValidators: true }
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
            user: req.user.id,
            downloadReservation: null
        });

        if (!portfolio) {
            const existing = await Portfolio.findOne({ _id: req.params.id, user: req.user.id })
                .select("+downloadReservation");
            if (existing?.downloadReservation) {
                return res.status(409).json({
                    code: "DOWNLOAD_IN_PROGRESS",
                    message: "The portfolio cannot be deleted during its first download. Please retry shortly."
                });
            }
            return res.status(404).json({
                message: "Portfolio not found"
            });
        }

        return res.status(200).json({
            message: "Portfolio deleted successfully"
        });
    } catch (error) {
        console.error("Delete portfolio error:", error?.name || "PORTFOLIO_DELETE_ERROR", error?.code || "UNKNOWN");

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
