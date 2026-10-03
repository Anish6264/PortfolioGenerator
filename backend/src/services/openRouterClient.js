const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 90_000;

const createProviderError = (status, code, message) => {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    return error;
};

const getOpenRouterConfig = () => {
    const apiKey = typeof process.env.OPENROUTER_API_KEY === "string"
        ? process.env.OPENROUTER_API_KEY.trim()
        : "";
    const configuredModel = typeof process.env.OPENROUTER_MODEL === "string" && process.env.OPENROUTER_MODEL.trim()
        ? process.env.OPENROUTER_MODEL.trim()
        : typeof process.env.OPENAI_MODEL === "string"
            ? process.env.OPENAI_MODEL.trim()
            : "";

    if (!apiKey || !configuredModel) {
        throw createProviderError(503, "OPENROUTER_NOT_CONFIGURED", "OpenRouter is not configured.");
    }

    return {
        apiKey,
        model: configuredModel.includes("/") ? configuredModel : `openai/${configuredModel}`
    };
};

const requestOpenRouterCompletion = async (body) => {
    const { apiKey } = getOpenRouterConfig();
    let response;

    try {
        response = await fetch(OPENROUTER_CHAT_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        });
    } catch (error) {
        if (error?.name === "TimeoutError" || error?.name === "AbortError") {
            throw createProviderError(504, "OPENROUTER_TIMEOUT", "OpenRouter request timed out.");
        }
        throw createProviderError(502, "OPENROUTER_UNAVAILABLE", "OpenRouter is temporarily unavailable.");
    }

    let payload;
    try {
        payload = await response.json();
    } catch {
        throw createProviderError(502, "OPENROUTER_INVALID_RESPONSE", "OpenRouter returned an invalid response.");
    }

    if (!response.ok || payload?.error) {
        const status = response.status === 429 ? 429 : 502;
        const code = response.status === 429 ? "OPENROUTER_RATE_LIMIT" : "OPENROUTER_PROVIDER_ERROR";
        console.warn("OpenRouter request failed:", status, code);
        throw createProviderError(status, code, "OpenRouter could not complete the request.");
    }

    return payload;
};

const getOpenRouterModel = () => getOpenRouterConfig().model;

module.exports = { requestOpenRouterCompletion, getOpenRouterModel, createProviderError };
