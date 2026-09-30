const contentLimits = {
    about: 4000,
    shortIntro: 1000,
    projectDescription: 2000,
    experienceDescription: 2000,
    skills: 1500
};

const validateInput = (type, input, context = {}) => {
    if (!Object.prototype.hasOwnProperty.call(contentLimits, type)) return "Unsupported content type";
    if (typeof input !== "string" || input.length > 4000) return "Content input must be text within the allowed limit";
    if (!context || typeof context !== "object" || Array.isArray(context)) return "Context must be an object";

    const allowedContext = new Set([
        "profession", "title", "skills", "projectTitle", "technologies", "role", "existingDescription"
    ]);
    if (Object.keys(context).some((key) => !allowedContext.has(key))) return "Context contains unsupported fields";
    for (const [key, value] of Object.entries(context)) {
        if (typeof value === "string" && value.length > 500) return `${key} exceeds the allowed length`;
        if (Array.isArray(value) && (value.length > 50 || value.some((item) => typeof item !== "string" || item.length > 100))) {
            return `${key} must contain short text values`;
        }
        if (typeof value !== "string" && !Array.isArray(value)) return `${key} must be text or a list of text values`;
    }
    return null;
};

const validateGeneratedText = (type, text) => {
    const limit = contentLimits[type];
    if (!limit) return "Unsupported content type";
    if (typeof text !== "string" || !text.trim() || text.length > limit) {
        return `Generated content must be non-empty text of ${limit} characters or fewer`;
    }
    return null;
};

const buildMinimalAIContext = (type, input, context = {}) => {
    const allowed = {
        about: ["title", "skills"],
        shortIntro: ["title", "skills"],
        projectDescription: ["projectTitle", "technologies", "existingDescription"],
        experienceDescription: ["role", "title", "existingDescription", "skills"],
        skills: ["title", "skills"]
    }[type] || [];
    const result = {};
    for (const key of allowed) {
        const value = context[key];
        if (typeof value === "string") result[key] = value.slice(0, 500);
        else if (Array.isArray(value)) result[key] = value.filter((item) => typeof item === "string").slice(0, 30).map((item) => item.slice(0, 100));
    }
    return { type, input: typeof input === "string" ? input.slice(0, 4000) : "", context: result };
};

const generateContent = async (type, input, context = {}) => {
    const validationError = validateInput(type, input, context);
    if (validationError) {
        const error = new Error(validationError);
        error.status = 400;
        throw error;
    }

    return {
        type,
        content: null,
        suggestions: [],
        providerStatus: "not_configured",
        maxLength: contentLimits[type],
        message: "AI content generation is not configured yet. No content was changed."
    };
};

module.exports = { generateContent, validateInput, validateGeneratedText, buildMinimalAIContext, contentLimits };
