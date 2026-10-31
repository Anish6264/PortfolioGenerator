const { test } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "mock-normal-jwt-secret";
process.env.ADMIN_EMAIL = "owner@example.test";
process.env.ADMIN_ACCESS_CODE = "Mock-Admin-Access-Only-For-Tests";

const User = require("../src/models/User");
const requireAdmin = require("../src/middleware/admin.middleware");
const requireAdminVerification = require("../src/middleware/adminVerification.middleware");
const { verifyAdminAccess } = require("../src/controllers/adminVerification.controller");
const {
    createAdminVerificationToken,
    safeSecretMatches
} = require("../src/utils/adminVerification");
const protect = require("../src/middleware/auth.middleware");
const adminRouter = require("../src/routes/admin.routes");
const portfolioRouter = require("../src/routes/portfolio.routes");
const createRateLimiter = require("../src/middleware/rateLimit.middleware");

const id = "0123456789abcdef01234567";
let currentUser;
User.findById = () => ({ select: async () => currentUser });

const response = () => ({
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    set() { return this; }
});
const makeRequest = ({ userId = id, user = currentUser, password, verificationToken } = {}) => ({
    user: { id: userId },
    adminUser: user,
    body: password === undefined ? {} : { password },
    headers: verificationToken ? { "x-admin-verification": verificationToken } : {},
    get(name) { return this.headers[name.toLowerCase()]; }
});

test("only an admin with the designated email can reach verification", async () => {
    currentUser = { role: "user", email: process.env.ADMIN_EMAIL };
    const res = response();
    let continued = false;
    await requireAdmin(makeRequest(), res, () => { continued = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(continued, false);

    currentUser = { role: "admin", email: "someone-else@example.test" };
    const roleResponse = response();
    await requireAdmin(makeRequest(), roleResponse, () => {});
    const mismatchResponse = response();
    verifyAdminAccess(makeRequest({ user: currentUser }), mismatchResponse);
    assert.equal(roleResponse.statusCode, 200);
    assert.equal(mismatchResponse.statusCode, 403);
});

test("incorrect and correct access codes are handled without revealing the configured code", async () => {
    currentUser = { role: "admin", email: " OWNER@example.test " };
    assert.equal(safeSecretMatches("wrong", process.env.ADMIN_ACCESS_CODE), false);
    assert.equal(safeSecretMatches(process.env.ADMIN_ACCESS_CODE, process.env.ADMIN_ACCESS_CODE), true);

    const wrongResponse = response();
    verifyAdminAccess(makeRequest({ password: "wrong" }), wrongResponse);
    assert.equal(wrongResponse.statusCode, 401);
    assert.doesNotMatch(JSON.stringify(wrongResponse.body), new RegExp(process.env.ADMIN_ACCESS_CODE));

    const successResponse = response();
    verifyAdminAccess(makeRequest({ password: process.env.ADMIN_ACCESS_CODE }), successResponse);
    assert.equal(successResponse.statusCode, 200);
    assert.equal(typeof successResponse.body.verificationToken, "string");
    assert.equal(successResponse.body.password, undefined);
    const decoded = jwt.decode(successResponse.body.verificationToken);
    assert.equal(decoded.type, "admin_verification");
    assert.equal(decoded.id, id);
    assert.equal(decoded.exp - decoded.iat, 15 * 60);
});

test("admin APIs require an unexpired token bound to the current admin identity", () => {
    currentUser = { role: "admin", email: process.env.ADMIN_EMAIL };
    const validToken = createAdminVerificationToken({ userId: id, email: currentUser.email });
    let continued = false;
    const validResponse = response();
    requireAdminVerification(makeRequest({ verificationToken: validToken }), validResponse, () => { continued = true; });
    assert.equal(continued, true);

    for (const token of [
        undefined,
        createAdminVerificationToken({ userId: "1123456789abcdef01234567", email: currentUser.email }),
        createAdminVerificationToken({ userId: id, email: "other@example.test" }),
        createAdminVerificationToken({ userId: id, email: currentUser.email, expiresIn: "-1s" }),
        jwt.sign({ id, type: "admin_verification", email: currentUser.email }, process.env.JWT_SECRET, { expiresIn: "15m" })
    ]) {
        const res = response();
        requireAdminVerification(makeRequest({ verificationToken: token }), res, () => assert.fail("invalid token must not pass"));
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.code, "ADMIN_VERIFICATION_REQUIRED");
    }

    const ordinaryTokenResponse = response();
    const ordinaryToken = jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "15m" });
    const ordinaryRequest = { headers: { authorization: `Bearer ${ordinaryToken}` } };
    let authenticated = false;
    protect(ordinaryRequest, ordinaryTokenResponse, () => { authenticated = true; });
    assert.equal(authenticated, true, "normal authentication remains compatible");

    let adminTokenAuthenticated = false;
    const adminOnlyToken = createAdminVerificationToken({ userId: id, email: currentUser.email });
    const adminTokenResponse = response();
    protect({ headers: { authorization: `Bearer ${adminOnlyToken}` } }, adminTokenResponse, () => { adminTokenAuthenticated = true; });
    assert.equal(adminTokenAuthenticated, false, "the verification token cannot be used as an ordinary login token");
    assert.equal(adminTokenResponse.statusCode, 401);
});

test("admin verification requires ADMIN_EMAIL and ADMIN_ACCESS_CODE configuration", () => {
    const originalEmail = process.env.ADMIN_EMAIL;
    const originalCode = process.env.ADMIN_ACCESS_CODE;
    currentUser = { role: "admin", email: originalEmail };
    process.env.ADMIN_EMAIL = "";
    let res = response();
    verifyAdminAccess(makeRequest({ password: originalCode }), res);
    assert.equal(res.statusCode, 403);
    process.env.ADMIN_EMAIL = originalEmail;
    process.env.ADMIN_ACCESS_CODE = "";
    res = response();
    verifyAdminAccess(makeRequest({ password: originalCode }), res);
    assert.equal(res.statusCode, 403);
    process.env.ADMIN_EMAIL = originalEmail;
    process.env.ADMIN_ACCESS_CODE = originalCode;
});

test("the verify endpoint is role protected, all admin APIs require verification, and attempts are limited", () => {
    const layers = adminRouter.stack;
    const verifyRoute = layers.find((layer) => layer.route?.path === "/verify");
    assert.deepEqual(verifyRoute.route.stack.slice(0, 2).map((layer) => layer.name), ["protect", "requireAdmin"]);

    const adminGate = layers.filter((layer) => !layer.route).map((layer) => layer.name);
    assert.deepEqual(adminGate, ["protect", "requireAdmin", "requireAdminVerification"]);
    const apiRoutes = layers.filter((layer) => layer.route && layer.route.path !== "/verify");
    assert.ok(apiRoutes.length > 0);
    assert.ok(apiRoutes.every((layer) => layers.indexOf(layer) > layers.indexOf(layers.find((entry) => entry.name === "requireAdminVerification"))));

    const portfolioMiddlewareNames = portfolioRouter.stack.flatMap((layer) => layer.route?.stack?.map((entry) => entry.name) || [layer.name]);
    assert.ok(!portfolioMiddlewareNames.includes("requireAdminVerification"), "ordinary portfolio API middleware remains unchanged");

    const limiter = verifyRoute.route.stack[2].handle;
    const ip = "admin-verification-test-ip";
    let passed = 0;
    let limitedResponse;
    for (let attempt = 0; attempt < 6; attempt += 1) {
        const res = response();
        limiter({ ip }, res, () => { passed += 1; });
        if (res.statusCode === 429) limitedResponse = res;
    }
    assert.equal(passed, 5);
    assert.equal(limitedResponse?.statusCode, 429);
});
