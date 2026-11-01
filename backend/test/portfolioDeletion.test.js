const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const Portfolio = require("../src/models/Portfolio");
const uploadAssets = require("../src/services/uploadAssets.service");
const { deletePortfolio } = require("../src/controllers/portfolio.controller");

const uploadDirectory = path.resolve(__dirname, "../src/uploads");
const portfolioId = "0123456789abcdef01234567";
const userId = "1123456789abcdef01234567";

const makeResponse = () => ({
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
});

const runDelete = (response) => deletePortfolio({
    params: { id: portfolioId },
    user: { id: userId }
}, response);

const managedReference = (extension) => `uploads/${Date.now()}-${Math.floor(Math.random() * 1e9)}.${extension}`;

const withManagedFiles = async (references, callback) => {
    await fs.mkdir(uploadDirectory, { recursive: true });
    const paths = references.map((reference) => path.join(uploadDirectory, path.basename(reference)));
    await Promise.all(paths.map((filePath) => fs.writeFile(filePath, "test-only temporary upload")));
    try {
        return await callback(paths);
    } finally {
        await Promise.all(paths.map((filePath) => fs.rm(filePath, { force: true })));
    }
};

const mockDeletion = (t, deletedPortfolio, { reservation = null, onExists = async () => false } = {}) => {
    let deletionFilter;
    let existsCalls = 0;
    t.mock.method(Portfolio, "findOneAndDelete", async (filter) => {
        deletionFilter = filter;
        return deletedPortfolio;
    });
    t.mock.method(Portfolio, "findOne", () => ({
        select: async () => reservation ? { downloadReservation: reservation } : null
    }));
    t.mock.method(Portfolio, "exists", async (filter) => {
        existsCalls += 1;
        return onExists(filter);
    });
    return {
        getDeletionFilter: () => deletionFilter,
        getExistsCalls: () => existsCalls
    };
};

const portfolioWithAssets = (resume, profileImage) => ({
    _id: portfolioId,
    resume,
    personal: { profileImage }
});

test("deletes unshared managed resume and profile image after successful database deletion", async (t) => {
    const resume = managedReference("pdf");
    const profileImage = managedReference("png");
    const model = mockDeletion(t, portfolioWithAssets(resume, profileImage));
    const removeCalls = [];
    const actualRemove = uploadAssets.removeManagedUpload;
    t.mock.method(uploadAssets, "removeManagedUpload", async (...args) => {
        removeCalls.push(args);
        return actualRemove(...args);
    });

    await withManagedFiles([resume, profileImage], async (paths) => {
        const response = makeResponse();
        await runDelete(response);
        assert.equal(response.statusCode, 200);
        assert.deepEqual(model.getDeletionFilter(), {
            _id: portfolioId,
            user: userId,
            downloadReservation: null
        });
        assert.deepEqual(removeCalls, [[resume, "resume"], [profileImage, "profileImage"]]);
        for (const filePath of paths) await assert.rejects(fs.access(filePath), { code: "ENOENT" });
    });
});

test("preserves shared resume and profile-image files", async (t) => {
    const resume = managedReference("pdf");
    const profileImage = managedReference("webp");
    mockDeletion(t, portfolioWithAssets(resume, profileImage), { onExists: async () => true });
    const removeCalls = [];
    t.mock.method(uploadAssets, "removeManagedUpload", async (...args) => { removeCalls.push(args); });

    await withManagedFiles([resume, profileImage], async (paths) => {
        const response = makeResponse();
        await runDelete(response);
        assert.equal(response.statusCode, 200);
        assert.deepEqual(removeCalls, []);
        for (const filePath of paths) await fs.access(filePath);
    });
});

test("missing managed files do not fail a successful portfolio deletion", async (t) => {
    const resume = managedReference("pdf");
    mockDeletion(t, portfolioWithAssets(resume, ""));
    const actualRemove = uploadAssets.removeManagedUpload;
    t.mock.method(uploadAssets, "removeManagedUpload", (...args) => actualRemove(...args));

    const response = makeResponse();
    await runDelete(response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, { message: "Portfolio deleted successfully" });
});

test("skips external profile-image URLs", async (t) => {
    mockDeletion(t, portfolioWithAssets("", "HTTPS://images.example.test/photo.webp"));
    let removeCalls = 0;
    t.mock.method(uploadAssets, "removeManagedUpload", async () => { removeCalls += 1; });

    const response = makeResponse();
    await runDelete(response);
    assert.equal(response.statusCode, 200);
    assert.equal(removeCalls, 0);
});

test("invalid and outside-directory references cannot delete arbitrary files", async (t) => {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "portfolio-delete-"));
    const outsideFile = path.join(tempDirectory, "keep.txt");
    await fs.writeFile(outsideFile, "must remain");
    const outsideReference = path.join(tempDirectory, "keep.txt");
    mockDeletion(t, portfolioWithAssets("uploads/../../outside.pdf", outsideReference));
    const actualRemove = uploadAssets.removeManagedUpload;
    t.mock.method(uploadAssets, "removeManagedUpload", (...args) => actualRemove(...args));
    const warnings = [];
    t.mock.method(console, "error", (...args) => warnings.push(args));

    try {
        const response = makeResponse();
        await runDelete(response);
        assert.equal(response.statusCode, 200);
        assert.equal(await fs.readFile(outsideFile, "utf8"), "must remain");
        assert.equal(warnings.length, 2);
        assert.ok(warnings.every((args) => args.length === 2 && args[1] === "UNSAFE_UPLOAD_REFERENCE"));
    } finally {
        await fs.rm(tempDirectory, { recursive: true, force: true });
    }
});

test("database deletion failure does not attempt asset cleanup", async (t) => {
    t.mock.method(Portfolio, "findOneAndDelete", async () => { throw new Error("database failure"); });
    t.mock.method(Portfolio, "findOne", () => ({ select: async () => null }));
    let existsCalls = 0;
    t.mock.method(Portfolio, "exists", async () => { existsCalls += 1; return false; });
    let removeCalls = 0;
    t.mock.method(uploadAssets, "removeManagedUpload", async () => { removeCalls += 1; });
    t.mock.method(console, "error", () => {});

    const response = makeResponse();
    await runDelete(response);
    assert.equal(response.statusCode, 500);
    assert.equal(existsCalls, 0);
    assert.equal(removeCalls, 0);
});

test("active download reservation prevents deletion and cleanup", async (t) => {
    const reservation = { _id: "reservation-id" };
    const model = mockDeletion(t, null, { reservation });
    let removeCalls = 0;
    t.mock.method(uploadAssets, "removeManagedUpload", async () => { removeCalls += 1; });

    const response = makeResponse();
    await runDelete(response);
    assert.equal(response.statusCode, 409);
    assert.equal(response.body.code, "DOWNLOAD_IN_PROGRESS");
    assert.equal(model.getExistsCalls(), 0);
    assert.equal(removeCalls, 0);
});

test("cleanup failures do not change the successful deletion response and assets are independent", async (t) => {
    const resume = managedReference("pdf");
    const profileImage = managedReference("jpeg");
    mockDeletion(t, portfolioWithAssets(resume, profileImage));
    const calls = [];
    const actualRemove = uploadAssets.removeManagedUpload;
    t.mock.method(uploadAssets, "removeManagedUpload", async (reference, kind) => {
        calls.push([reference, kind]);
        if (kind === "resume") {
            const error = new Error("filesystem failure");
            error.code = "EACCES";
            throw error;
        }
        return actualRemove(reference, kind);
    });
    const warnings = [];
    t.mock.method(console, "error", (...args) => warnings.push(args));

    await withManagedFiles([resume, profileImage], async (paths) => {
        const response = makeResponse();
        await runDelete(response);
        assert.equal(response.statusCode, 200);
        assert.deepEqual(calls, [[resume, "resume"], [profileImage, "profileImage"]]);
        await fs.access(paths[0]);
        await assert.rejects(fs.access(paths[1]), { code: "ENOENT" });
        assert.deepEqual(warnings, [["Deleted portfolio asset cleanup failed:", "EACCES"]]);
    });
});
