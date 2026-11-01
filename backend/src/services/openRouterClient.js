const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 90_000;

const createProviderError = (status, code, message) => {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    return error;
};

const sanitizeDiagnosticText = (value, maxLength = 240) => {
    if (typeof value !== "string") return "";
    return value
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]")
        .replace(/\b(?:sk|or|key)[-_][A-Za-z0-9_-]{8,}\b/gi, "[redacted]")
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
        .replace(/https?:\/\/\S+/gi, "[redacted-url]")
        .replace(/\b(?:\+?\d[\d ().-]{7,}\d)\b/g, "[redacted-number]")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength);
};

const getProviderErrorDetails = (payload) => {
    const providerError = payload?.error;
    if (typeof providerError === "string") {
        return { code: "", message: sanitizeDiagnosticText(providerError) };
    }
    if (!providerError || typeof providerError !== "object" || Array.isArray(providerError)) {
        return { code: "", message: "Provider returned an error without details." };
    }
    const rawCode = providerError.code ?? providerError.type;
    const code = typeof rawCode === "string" || typeof rawCode === "number"
        ? sanitizeDiagnosticText(String(rawCode), 80).replace(/[^a-zA-Z0-9_.:-]/g, "")
        : "";
    const rawMessage = typeof providerError.message === "string" ? providerError.message : "";
    return {
        code,
        message: sanitizeDiagnosticText(rawMessage) || "Provider returned an error without details."
    };
};

const getRequestId = (response) => {
    const value = response.headers?.get("x-request-id")
        || response.headers?.get("x-openrouter-request-id")
        || response.headers?.get("request-id");
    return sanitizeDiagnosticText(value, 128).replace(/[^a-zA-Z0-9_.:-]/g, "");
};

const logProviderFailure = ({ response, payload, message }) => {
    const details = getProviderErrorDetails(payload);
    console.warn("OpenRouter request failed:", {
        upstreamStatus: response.status,
        providerCode: details.code || undefined,
        providerMessage: message || details.message,
        requestId: getRequestId(response) || undefined
    });
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
        if (!response.ok) {
            logProviderFailure({ response, message: "Provider returned a non-JSON error response." });
            const error = createProviderError(502, "OPENROUTER_PROVIDER_ERROR", "OpenRouter could not complete the request.");
            error.upstreamStatus = response.status;
            throw error;
        }
        const error = createProviderError(502, "OPENROUTER_INVALID_RESPONSE", "OpenRouter returned an invalid response.");
        error.upstreamStatus = response.status;
        throw error;
    }

    if (!response.ok || payload?.error) {
        const status = response.status === 429 ? 429 : 502;
        const code = response.status === 429 ? "OPENROUTER_RATE_LIMIT" : "OPENROUTER_PROVIDER_ERROR";
        logProviderFailure({ response, payload });
        const error = createProviderError(status, code, "OpenRouter could not complete the request.");
        error.upstreamStatus = response.status;
        throw error;
    }

    return payload;
};

const getOpenRouterModel = () => getOpenRouterConfig().model;

module.exports = { requestOpenRouterCompletion, getOpenRouterModel, createProviderError };
