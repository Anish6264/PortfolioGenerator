const Portfolio = require("../models/Portfolio");

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
    "resume"
];

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

        const portfolio = await Portfolio.create({
            ...portfolioData,
            user: req.user.id
        });

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
    deletePortfolio
};
