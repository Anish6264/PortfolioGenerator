const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { Readable } = require("node:stream");
const test = require("node:test");
const jwt = require("jsonwebtoken");

const Portfolio = require("../src/models/Portfolio");
const { extractResumeText, analyzePortfolioResume, normalizeResumeAnalysis } = require("../src/services/resumeImport.service");
const { analyzeResumeText, MAX_RESUME_TEXT_LENGTH } = require("../src/services/resumeAnalysis.provider");
const upload = require("../src/middleware/upload.middleware");
const protect = require("../src/middleware/auth.middleware");
const { importResume } = require("../src/controllers/import.controller");

const validAnalysis = () => ({
    personal: { name: "Test Candidate", title: "Developer", email: "test@example.com", phone: "", location: "" },
    shortIntro: "Developer with experience.",
    about: "Builds useful software.",
    skills: ["JavaScript"],
    education: [],
    experience: [],
    projects: [],
    social: { github: "", linkedin: "", twitter: "" }
});

const escapePdfText = (value) => value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");

const makePdf = (pageTexts) => {
    const pageCount = pageTexts.length;
    const fontId = 3 + pageCount * 2;
    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        `<< /Type /Pages /Kids [${pageTexts.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pageCount} >>`
    ];
    for (let index = 0; index < pageCount; index += 1) {
        const pageId = 3 + index * 2;
        const contentId = pageId + 1;
        const stream = `BT /F1 12 Tf 40 740 Td (${escapePdfText(pageTexts[index])}) Tj ET`;
        objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
        objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    }
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
        offsets.push(Buffer.byteLength(pdf));
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xrefOffset = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, "ascii");
};

const makeMultipartRequest = (pdfBuffer) => {
    const boundary = "----portfolio-resume-test-boundary";
    const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="resume"; filename="resume.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
        pdfBuffer,
        Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);
    const req = Readable.from([body]);
    req.headers = { "content-type": `multipart/form-data; boundary=${boundary}`, "content-length": String(body.length) };
    req.method = "POST";
    req.url = "/resume";
    req.originalUrl = "/api/import/resume";
    req.path = "/resume";
    req.ip = "127.0.0.1";
    req.params = {};
    return req;
};

const runTemporaryUpload = async (req, response) => {
    const authResponse = {
        status(code) { response.status(code); return this; },
        json(body) { response.json(body); return this; }
    };
    let authError;
    protect(req, authResponse, (error) => { authError = error; });
    if (authError || response.statusCode !== 200) return;
    await new Promise((resolve, reject) => upload.single("resume")(req, {}, (error) => error ? reject(error) : resolve()));
    await importResume(req, response);
    return req;
};

const makeResponse = () => ({
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
});

const withJwtSecret = async (callback) => {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "test-only-jwt-secret";
    try {
        return await callback();
    } finally {
        if (previousSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = previousSecret;
    }
};

const withProviderConfig = async (callback) => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    const previousModel = process.env.OPENROUTER_MODEL;
    process.env.OPENROUTER_API_KEY = "test-only-key";
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

test("extracts text from every PDF page and preserves page boundaries", async () => {
    const extracted = await extractResumeText(makePdf([
        "Candidate Profile and Software Engineering Experience",
        "Projects and JavaScript Skills"
    ]));
    assert.match(extracted, /Candidate Profile and Software Engineering Experience/);
    assert.match(extracted, /Projects and JavaScript Skills/);
    assert.match(extracted, /\n\n/);
});

test("rejects malformed PDF data without exposing parser details", async () => {
    await assert.rejects(extractResumeText(Buffer.from("not a pdf")), (error) => {
        assert.equal(error.code, "INVALID_RESUME_PDF");
        assert.equal(error.status, 400);
        return true;
    });
});

test("rejects empty and image-only PDFs with a specific no-text error", async () => {
    await assert.rejects(extractResumeText(makePdf([""])), (error) => {
        assert.equal(error.code, "RESUME_NO_EXTRACTABLE_TEXT");
        assert.equal(error.status, 422);
        return true;
    });
});

test("rejects excessive extracted text before sending it to the provider", async () => {
    await assert.rejects(analyzeResumeText("x".repeat(MAX_RESUME_TEXT_LENGTH + 1)), { code: "RESUME_TEXT_TOO_LARGE" });
});

test("sends extracted text to OpenRouter and retains strict JSON Schema output", async (t) => {
    await withProviderConfig(async () => {
        t.mock.method(globalThis, "fetch", async (_url, options) => {
            const request = JSON.parse(options.body);
            assert.equal(request.response_format.json_schema.strict, true);
            assert.match(request.messages[1].content, /Test Candidate resume text/);
            assert.equal(typeof request.messages[1].content, "string");
            return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(validAnalysis()) } }] }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        });
        const result = await analyzeResumeText("Test Candidate resume text with skills and work history.");
        assert.equal(result.personal.name, "Test Candidate");
    });
});

test("maps OpenRouter provider failures into the existing provider error convention", async (t) => {
    await withProviderConfig(async () => {
        t.mock.method(globalThis, "fetch", async () => new Response("{}", { status: 503 }));
        await assert.rejects(analyzeResumeText("Candidate has professional software experience."), {
            code: "OPENROUTER_PROVIDER_ERROR",
            status: 502
        });
    });
});

test("rejects malformed AI JSON and invalid structured analysis", async (t) => {
    await withProviderConfig(async () => {
        t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
            choices: [{ message: { content: "{not json" } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } }));
        await assert.rejects(analyzeResumeText("Candidate has professional software experience."), {
            code: "RESUME_ANALYSIS_INVALID_OUTPUT",
            status: 502
        });
    });
    assert.throws(() => normalizeResumeAnalysis({ ...validAnalysis(), extra: true }), {
        code: "RESUME_ANALYSIS_INVALID_OUTPUT"
    });
});

test("normalizes valid schema output into the existing Builder proposal shape", () => {
    const proposedData = normalizeResumeAnalysis(validAnalysis());
    assert.deepEqual(Object.keys(proposedData).sort(), ["about", "personal", "shortIntro", "skills"]);
    assert.equal(proposedData.personal.email, "test@example.com");
});

test("analysis still scopes portfolio lookup to the authenticated owner", async (t) => {
    const originalFindOne = Portfolio.findOne;
    let capturedFilter;
    t.mock.method(Portfolio, "findOne", (filter) => {
        capturedFilter = filter;
        return { select: async () => null };
    });
    try {
        await assert.rejects(analyzePortfolioResume("64b000000000000000000001", "owner-id"), {
            code: "PORTFOLIO_NOT_FOUND",
            status: 404
        });
        assert.deepEqual(capturedFilter, { _id: "64b000000000000000000001", user: "owner-id" });
    } finally {
        Portfolio.findOne = originalFindOne;
    }
});

test("temporary multipart analysis returns the Builder contract without writing a portfolio and deletes its upload", async (t) => {
    await withJwtSecret(() => withProviderConfig(async () => {
        let databaseCalls = 0;
        t.mock.method(Portfolio, "findOne", async () => { databaseCalls += 1; throw new Error("unexpected database read"); });
        t.mock.method(Portfolio, "create", async () => { databaseCalls += 1; throw new Error("unexpected portfolio creation"); });
        t.mock.method(globalThis, "fetch", async (_url, options) => {
            const payload = JSON.parse(options.body);
            assert.match(payload.messages[1].content, /First page content/);
            assert.match(payload.messages[1].content, /Second page content/);
            return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(validAnalysis()) } }] }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        });

        const req = makeMultipartRequest(makePdf(["First page content for an engineer resume", "Second page content with project details"]));
        req.headers.authorization = `Bearer ${jwt.sign({ id: "64b000000000000000000002" }, process.env.JWT_SECRET, { algorithm: "HS256" })}`;
        const response = makeResponse();
        await runTemporaryUpload(req, response);

        assert.equal(response.statusCode, 200, JSON.stringify(response.body));
        assert.deepEqual(response.body, {
            status: "ready",
            source: "AI Resume Analysis",
            proposedData: normalizeResumeAnalysis(validAnalysis())
        });
        assert.equal(databaseCalls, 0);
        await assert.rejects(fs.access(req.file.path), { code: "ENOENT" });
    }));
});

test("temporary multipart analysis deletes its upload when OpenRouter fails", async (t) => {
    await withJwtSecret(() => withProviderConfig(async () => {
        t.mock.method(globalThis, "fetch", async () => new Response("{}", { status: 503 }));
        const req = makeMultipartRequest(makePdf(["Resume content with enough readable text to analyze"]));
        req.headers.authorization = `Bearer ${jwt.sign({ id: "64b000000000000000000003" }, process.env.JWT_SECRET, { algorithm: "HS256" })}`;
        const response = makeResponse();
        await runTemporaryUpload(req, response);
        assert.equal(response.statusCode, 502, JSON.stringify(response.body));
        assert.equal(response.body.message, "Unable to analyze the resume right now. Please try again.");
        await assert.rejects(fs.access(req.file.path), { code: "ENOENT" });
    }));
});

test("temporary multipart analysis rejects malformed and empty PDFs and removes both uploads", async () => {
    await withJwtSecret(async () => {
        for (const [pdf, expectedStatus, expectedMessage] of [
            [Buffer.from("not a PDF"), 400, "The resume PDF is malformed or could not be read. Upload a valid PDF and try again."],
            [makePdf([""]), 422, "No readable text was found. Scanned or image-only PDFs need OCR and cannot be analyzed yet."]
        ]) {
            const req = makeMultipartRequest(pdf);
            req.headers.authorization = `Bearer ${jwt.sign({ id: "64b000000000000000000004" }, process.env.JWT_SECRET, { algorithm: "HS256" })}`;
            const response = makeResponse();
            await runTemporaryUpload(req, response);
            assert.equal(response.statusCode, expectedStatus);
            assert.equal(response.body.message, expectedMessage);
            await assert.rejects(fs.access(req.file.path), { code: "ENOENT" });
        }
    });
});

test("analysis controller response remains compatible with the Builder", async () => {
    const resumeService = require("../src/services/resumeImport.service");
    const originalAnalyze = resumeService.analyzePortfolioResume;
    const proposedData = { personal: { name: "Test Candidate" } };
    resumeService.analyzePortfolioResume = async () => proposedData;
    delete require.cache[require.resolve("../src/controllers/import.controller")];
    const { analyzeResume } = require("../src/controllers/import.controller");
    resumeService.analyzePortfolioResume = originalAnalyze;

    let statusCode;
    let payload;
    const response = {
        status(code) { statusCode = code; return this; },
        json(body) { payload = body; return this; }
    };
    await analyzeResume({ body: { portfolioId: "portfolio-id" }, user: { id: "user-id" } }, response);
    assert.equal(statusCode, 200);
    assert.deepEqual(payload, { status: "ready", source: "AI Resume Analysis", proposedData });
});
