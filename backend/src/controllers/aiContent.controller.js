const { generateContent, buildMinimalAIContext } = require("../services/aiContent.service");
const { enhanceText, validateEnhanceInput } = require("../services/aiEnhance.service");

const requestGeneratedContent = async (req, res) => {
    try {
        const { type, input, context } = req.body || {};
        const minimal = buildMinimalAIContext(type, input, context || {});
        const result = await generateContent(minimal.type, minimal.input, minimal.context);
        if (result.providerStatus === "not_configured") {
            return res.status(503).json(result);
        }
        return res.status(200).json(result);
    } catch (error) {
        if (error.status === 400) return res.status(400).json({ message: error.message });
        if (error?.code === "AI_PROVIDER_ERROR" || error?.code === "AI_GENERATION_FAILED") {
            console.error("AI content generation failed:", error.code);
            return res.status(error.status || 502).json({ message: error.message });
        }
        console.error("AI content boundary failed:", error?.code || "AI_REQUEST_FAILED");
        return res.status(500).json({ message: "Unable to prepare content generation" });
    }
};

const requestEnhancedContent = async (req, res) => {
    const body = req.body || {};
    if (Object.keys(body).some((key) => !["field", "text"].includes(key))) {
        return res.status(400).json({ message: "Only a supported field and its text can be enhanced." });
    }

    const validationError = validateEnhanceInput(body);
    if (validationError) return res.status(400).json({ message: validationError });

    try {
        const enhancedText = await enhanceText(body);
        return res.status(200).json({ success: true, enhancedText });
    } catch (error) {
        const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600
            ? error.status
            : 502;
        const message = status === 429
            ? "AI Enhance is rate limited right now. Please try again later."
            : status === 504
                ? "AI Enhance timed out. Please try again."
                : status === 503
                    ? "AI Enhance is not configured."
                    : "AI Enhance is temporarily unavailable. Please try again.";
        console.warn("AI Enhance request failed:", error?.code || "AI_ENHANCE_FAILED", status);
        return res.status(status).json({ message });
    }
};

module.exports = { requestGeneratedContent, requestEnhancedContent };
