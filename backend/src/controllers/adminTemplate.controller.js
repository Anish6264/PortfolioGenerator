const Template = require("../models/Template");

const editableFields = new Set([
    "name",
    "description",
    "category",
    "thumbnail",
    "previewUrl",
    "isPremium",
    "creditCost",
    "isActive"
]);

const templateProjection = "name description category thumbnail previewUrl isPremium creditCost isActive createdAt updatedAt";
const supportedCategories = Template.schema.path("category").enumValues;
const isValidId = (value) => /^[a-f\d]{24}$/i.test(value || "");

const validateReference = (value, field) => {
    if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u001f\u007f\\]/.test(value)) {
        return `${field} must be a safe URL or relative reference of 2048 characters or fewer`;
    }

    const reference = value.trim();
    if (!reference) return null;

    try {
        const parsed = new URL(reference);
        if (["http:", "https:"].includes(parsed.protocol) && parsed.hostname) return null;
    } catch {
        // Relative references are allowed below.
    }

    if (
        reference.startsWith("//") ||
        reference.includes(":") ||
        reference.split("/").includes("..") ||
        !/^(?:\/|[A-Za-z0-9])[A-Za-z0-9._~!$&'()*+,;=@%/?#-]*$/.test(reference)
    ) {
        return `${field} must use HTTP, HTTPS, or a safe relative reference`;
    }

    return null;
};

const validateAndNormalizeUpdates = (body) => {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "Template updates must be an object" };
    }

    const keys = Object.keys(body);
    if (!keys.length || keys.some((key) => !editableFields.has(key))) {
        return { error: "Template updates contain unsupported fields" };
    }

    const updates = {};
    for (const field of ["name", "description"]) {
        if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
        if (typeof body[field] !== "string") {
            return { error: `${field} must be a string` };
        }
        const value = body[field].trim();
        const maxLength = field === "name" ? 120 : 2000;
        if (!value || value.length > maxLength) {
            return { error: `${field} is required and must be ${maxLength} characters or fewer` };
        }
        updates[field] = value;
    }

    if (Object.prototype.hasOwnProperty.call(body, "category")) {
        if (typeof body.category !== "string" || !supportedCategories.includes(body.category)) {
            return { error: "category is not supported" };
        }
        updates.category = body.category;
    }

    for (const field of ["thumbnail", "previewUrl"]) {
        if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
        const value = typeof body[field] === "string" ? body[field].trim() : body[field];
        const error = validateReference(value, field);
        if (error) return { error };
        updates[field] = value;
    }

    for (const field of ["isPremium", "isActive"]) {
        if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
        if (typeof body[field] !== "boolean") {
            return { error: `${field} must be a boolean` };
        }
        updates[field] = body[field];
    }

    if (Object.prototype.hasOwnProperty.call(body, "creditCost")) {
        if (!Number.isSafeInteger(body.creditCost) || body.creditCost < 0) {
            return { error: "creditCost must be a non-negative integer" };
        }
        updates.creditCost = body.creditCost;
    }

    return { updates };
};

const getAdminTemplates = async (req, res) => {
    try {
        const templates = await Template.find({})
            .select(templateProjection)
            .sort({ createdAt: -1 });
        return res.status(200).json({ templates, categories: supportedCategories });
    } catch {
        console.error("Admin template list failed");
        return res.status(500).json({ message: "Server error" });
    }
};

const getAdminTemplate = async (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(400).json({ message: "Invalid template ID" });
    }

    try {
        const template = await Template.findById(req.params.id).select(templateProjection);
        if (!template) return res.status(404).json({ message: "Template not found" });
        return res.status(200).json({ template, categories: supportedCategories });
    } catch {
        console.error("Admin template lookup failed");
        return res.status(500).json({ message: "Server error" });
    }
};

const updateAdminTemplate = async (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(400).json({ message: "Invalid template ID" });
    }

    const validation = validateAndNormalizeUpdates(req.body);
    if (validation.error) return res.status(400).json({ message: validation.error });

    try {
        const template = await Template.findById(req.params.id);
        if (!template) return res.status(404).json({ message: "Template not found" });

        const updates = validation.updates;
        const isPremium = Object.prototype.hasOwnProperty.call(updates, "isPremium")
            ? updates.isPremium
            : template.isPremium;
        const requestedCost = Object.prototype.hasOwnProperty.call(updates, "creditCost")
            ? updates.creditCost
            : template.creditCost;

        if (isPremium && (!Number.isSafeInteger(requestedCost) || requestedCost <= 0)) {
            return res.status(400).json({
                message: "Premium templates must have a positive integer credit cost"
            });
        }

        updates.creditCost = isPremium ? requestedCost : 0;
        template.set(updates);
        await template.save();

        const safeTemplate = await Template.findById(template._id).select(templateProjection);
        return res.status(200).json({
            message: "Template updated successfully",
            template: safeTemplate
        });
    } catch (error) {
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ message: "Invalid template information" });
        }
        console.error("Admin template update failed");
        return res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getAdminTemplates,
    getAdminTemplate,
    updateAdminTemplate,
    validateAndNormalizeUpdates,
    isValidId
};
