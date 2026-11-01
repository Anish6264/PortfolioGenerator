const assert = require("node:assert/strict");
const test = require("node:test");

const { requestOpenRouterCompletion } = require("../src/services/openRouterClient");

const withProviderConfig = async (callback) => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    const previousModel = process.env.OPENROUTER_MODEL;
    process.env.OPENROUTER_API_KEY = "test-only-secret-key";
    process.env.OPENROUTER_MODEL = "test/provider";
    try {
        return await callback();
    } finally {
        if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
        else process.env.OPENROUTER_API_KEY = previousKey;
        if (previousModel === undefined) delete process.env.OPENROUTER_MODEL;
        else process.env.OPENROUTER_MODEL = previousModel;
    }
};

const captureWarnings = (t) => {
    const warnings = [];
    t.mock.method(console, "warn", (...args) => warnings.push(args));
    return warnings;
};

test("preserves actual upstream status internally while keeping generic provider error", async (t) => {
    await withProviderConfig(async () => {
        const warnings = captureWarnings(t);
        t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ error: { code: "model_error", message: "upstream failed" } }), { status: 503 }));
        await assert.rejects(requestOpenRouterCompletion({ messages: [] }), (error) => {
            assert.equal(error.status, 502);
            assert.equal(error.code, "OPENROUTER_PROVIDER_ERROR");
            assert.equal(error.message, "OpenRouter could not complete the request.");
            assert.equal(error.upstreamStatus, 503);
            return true;
        });
        assert.equal(warnings[0][1].upstreamStatus, 503);
        assert.equal(warnings[0][1].providerCode, "model_error");
    });
});

test("logs a sanitized bounded provider message and response request ID only", async (t) => {
    await withProviderConfig(async () => {
        const warnings = captureWarnings(t);
        t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ error: {
            code: "invalid_request",
            message: `Rejected resume for jane.doe@example.com phone +1 (415) 555-0132 key sk-abcdefghijk https://private.example/${"x".repeat(300)} ${"provider detail ".repeat(40)}`
        } }), {
            status: 400,
            headers: { "x-request-id": "req_test-123" }
        }));
        await assert.rejects(requestOpenRouterCompletion({ messages: [{ content: "PRIVATE RESUME CONTENT" }] }), { code: "OPENROUTER_PROVIDER_ERROR" });
        const diagnostic = warnings[0][1];
        assert.equal(diagnostic.upstreamStatus, 400);
        assert.equal(diagnostic.requestId, "req_test-123");
        assert.ok(diagnostic.providerMessage.length <= 240);
        assert.doesNotMatch(JSON.stringify(diagnostic), /jane\.doe|415|sk-abcdefghijk|private\.example|PRIVATE RESUME CONTENT|test-only-secret-key/);
        assert.match(diagnostic.providerMessage, /redacted-email/);
        assert.match(diagnostic.providerMessage, /redacted-number/);
    });
});

test("handles missing and malformed error bodies without logging their contents", async (t) => {
    await withProviderConfig(async () => {
        const warnings = captureWarnings(t);
        const responses = [
            new Response("not json PRIVATE RESUME CONTENT", { status: 502, headers: { "x-openrouter-request-id": "req-malformed" } }),
            new Response(JSON.stringify({ error: null }), { status: 502 })
        ];
        t.mock.method(globalThis, "fetch", async () => responses.shift());
        await assert.rejects(requestOpenRouterCompletion({ messages: [] }), (error) => {
            assert.equal(error.code, "OPENROUTER_PROVIDER_ERROR");
            assert.equal(error.upstreamStatus, 502);
            return true;
        });
        assert.equal(warnings[0][1].requestId, "req-malformed");
        assert.doesNotMatch(JSON.stringify(warnings), /PRIVATE RESUME CONTENT|not json/);
        await assert.rejects(requestOpenRouterCompletion({ messages: [] }), { code: "OPENROUTER_PROVIDER_ERROR" });
        assert.equal(warnings[1][1].providerMessage, "Provider returned an error without details.");
    });
});

test("keeps timeout handling intact", async (t) => {
    await withProviderConfig(async () => {
        t.mock.method(globalThis, "fetch", async () => {
            const error = new Error("timeout");
            error.name = "TimeoutError";
            throw error;
        });
        await assert.rejects(requestOpenRouterCompletion({ messages: [] }), { status: 504, code: "OPENROUTER_TIMEOUT" });
    });
});

test("keeps rate-limit handling intact", async (t) => {
    await withProviderConfig(async () => {
        const warnings = captureWarnings(t);
        t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ error: { code: "rate_limited", message: "Try again later" } }), { status: 429 }));
        await assert.rejects(requestOpenRouterCompletion({ messages: [] }), (error) => {
            assert.equal(error.status, 429);
            assert.equal(error.code, "OPENROUTER_RATE_LIMIT");
            assert.equal(error.upstreamStatus, 429);
            return true;
        });
        assert.equal(warnings[0][1].upstreamStatus, 429);
    });
});
