const OpenAI = require("openai");

let client;

const getOpenAIClient = () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (typeof apiKey !== "string" || !apiKey.trim()) return null;
    if (!client) client = new OpenAI({ apiKey });
    return client;
};

module.exports = { getOpenAIClient };
