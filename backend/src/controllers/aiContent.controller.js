const { generateContent, buildMinimalAIContext } = require("../services/aiContent.service");

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
        console.error("AI content boundary error:", error);
        return res.status(500).json({ message: "Unable to prepare content generation" });
    }
};

module.exports = { requestGeneratedContent };
