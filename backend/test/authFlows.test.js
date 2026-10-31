const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");

const sentEmails = [];
let smtpFailure = null;
nodemailer.createTransport = () => ({ sendMail: async (mail) => {
    if (smtpFailure) throw smtpFailure;
    sentEmails.push(mail);
} });
process.env.SMTP_HOST = "smtp.example.invalid";
process.env.SMTP_PORT = "587";
process.env.SMTP_USER = "test@example.invalid";
process.env.SMTP_PASS = "mocked";
process.env.SMTP_FROM = "test@example.invalid";
process.env.FRONTEND_URL = "https://portfolio.example";
process.env.JWT_SECRET = "test-secret";

const User = require("../src/models/User");
const SignupVerification = require("../src/models/SignupVerification");
const auth = require("../src/controllers/auth.controller");
const { isValidPassword } = require("../src/utils/passwordValidation");

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const records = new Map();
const users = new Map();
let id = 0;

const makeResponse = () => ({
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
});
const request = (body = {}, params = {}) => ({ body, params });

const makeVerification = (data) => ({
    ...data,
    async save() { records.set(this.email, this); return this; }
});

SignupVerification.findOne = ({ email }) => {
    const record = records.get(email) || null;
    const query = Promise.resolve(record);
    query.select = async () => record;
    return query;
};
SignupVerification.findOneAndUpdate = async (filter, update, options = {}) => {
    if (options.upsert) {
        const record = makeVerification({ _id: String(++id), email: filter.email, ...update.$set });
        records.set(filter.email, record);
        return record;
    }
    const record = records.get(filter.email);
    if (!record || record.verificationTokenHash !== filter.verificationTokenHash || record.consumedAt || !record.verifiedAt || record.authorizationExpiresAt <= new Date()) return null;
    record.consumedAt = update.$set.consumedAt;
    return record;
};
SignupVerification.deleteOne = async ({ _id }) => {
    for (const [email, record] of records) if (record._id === _id) records.delete(email);
};

User.findOne = async ({ email }) => users.get(email) || null;
User.create = async (data) => {
    if (users.has(data.email)) { const error = new Error("duplicate"); error.code = 11000; throw error; }
    const user = { _id: String(++id), role: "user", credits: 10, avatar: "", ...data };
    users.set(data.email, user);
    return user;
};
User.findOneAndUpdate = async (filter, update) => {
    const user = [...users.values()].find((candidate) => candidate.resetPasswordToken === filter.resetPasswordToken && candidate.resetPasswordExpires > new Date());
    if (!user) return null;
    Object.assign(user, update.$set);
    delete user.resetPasswordToken;
    delete user.resetPasswordExpires;
    return user;
};

test("password policy accepts complete passwords and rejects each missing rule", () => {
    assert.equal(isValidPassword("StrongPass1!"), true);
    for (const password of ["Short1!", "lowercase1!", "UPPERCASE1!", "NoNumber!!", "NoSpecial123"]) {
        assert.equal(isValidPassword(password), false, password);
    }
    assert.equal(isValidPassword(`${"A".repeat(70)}1!`), false, "bcrypt byte limit is enforced");
});

test("signup OTP enforces attempts, expiration, resend invalidation and single-use registration authorization", async () => {
    const email = "signup@example.com";
    smtpFailure = null;
    sentEmails.length = 0;
    let response = makeResponse();
    await auth.requestSignupOtp(request({ email }), response);
    assert.equal(response.statusCode, 200);
    const firstOtp = sentEmails.at(-1).html.match(/>(\d{6}) · Expires/)[1];
    response = makeResponse();
    await auth.requestSignupOtp(request({ email }), response);
    assert.equal(response.statusCode, 429, "resend cooldown is enforced by the backend");

    response = makeResponse();
    await auth.verifySignupOtp(request({ email, otp: "000000" }), response);
    assert.equal(response.statusCode, 400);
    response = makeResponse();
    await auth.verifySignupOtp(request({ email, otp: firstOtp }), response);
    assert.equal(response.statusCode, 200);
    assert.match(records.get(email).otpHash, /^[a-f0-9]{64}$/, "successful verification preserves the required hashed OTP field");
    const { _id: ignoredId, ...verifiedRecord } = records.get(email);
    void ignoredId;
    const persistedVerification = new SignupVerification(verifiedRecord);
    await assert.doesNotReject(persistedVerification.validate(), "verified records continue to satisfy the Mongoose schema");
    const registrationToken = response.body.registrationToken;

    response = makeResponse();
    await auth.registerUser(request({ name: "Test User", email, password: "StrongPass1!" }), response);
    assert.equal(response.statusCode, 403, "direct registration without authorization is rejected");
    response = makeResponse();
    await auth.registerUser(request({ name: "Test User", email, password: "weakpass1" }), response);
    assert.equal(response.statusCode, 400, "backend independently enforces the signup password policy");
    response = makeResponse();
    await auth.registerUser(request({ name: "Test User", email, password: "StrongPass1!", registrationToken }), response);
    assert.equal(response.statusCode, 201);
    assert.equal(await bcrypt.compare("StrongPass1!", users.get(email).password), true);
    assert.ok(records.get(email).consumedAt, "registration consumes the verification authorization");

    response = makeResponse();
    await auth.requestSignupOtp(request({ email }), response);
    assert.equal(response.statusCode, 409, "duplicate email cannot request signup verification");

    response = makeResponse();
    await auth.registerUser(request({ name: "Test User", email, password: "StrongPass1!", registrationToken }), response);
    assert.equal(response.statusCode, 409, "consumed authorization cannot create a second account");

    const expiredEmail = "expired@example.com";
    response = makeResponse();
    await auth.requestSignupOtp(request({ email: expiredEmail }), response);
    records.get(expiredEmail).expiresAt = new Date(Date.now() - 1);
    response = makeResponse();
    await auth.verifySignupOtp(request({ email: expiredEmail, otp: sentEmails.at(-1).html.match(/>(\d{6}) · Expires/)[1] }), response);
    assert.equal(response.statusCode, 400);

    const lockedEmail = "locked@example.com";
    response = makeResponse();
    await auth.requestSignupOtp(request({ email: lockedEmail }), response);
    const lockedOtp = sentEmails.at(-1).html.match(/>(\d{6}) · Expires/)[1];
    for (let attempt = 0; attempt < 5; attempt += 1) {
        response = makeResponse();
        await auth.verifySignupOtp(request({ email: lockedEmail, otp: "999999" }), response);
    }
    response = makeResponse();
    await auth.verifySignupOtp(request({ email: lockedEmail, otp: lockedOtp }), response);
    assert.equal(response.statusCode, 429);

    const resendEmail = "resend@example.com";
    const originalRandomInt = crypto.randomInt;
    crypto.randomInt = () => 123456;
    response = makeResponse();
    await auth.requestSignupOtp(request({ email: resendEmail }), response);
    const oldOtp = sentEmails.at(-1).html.match(/>(\d{6}) · Expires/)[1];
    records.get(resendEmail).resendAfter = new Date(Date.now() - 1);
    crypto.randomInt = () => 123457;
    response = makeResponse();
    await auth.requestSignupOtp(request({ email: resendEmail }), response);
    crypto.randomInt = originalRandomInt;
    const newOtp = sentEmails.at(-1).html.match(/>(\d{6}) · Expires/)[1];
    assert.notEqual(oldOtp, newOtp);
    response = makeResponse();
    await auth.verifySignupOtp(request({ email: resendEmail, otp: oldOtp }), response);
    assert.equal(response.statusCode, 400);
});

test("forgot/reset password masks unknown accounts, hashes new password and consumes reset token", async () => {
    const email = "reset@example.com";
    smtpFailure = null;
    users.set(email, { _id: String(++id), email, password: await bcrypt.hash("OldPass1!", 10), save: async function () { users.set(email, this); } });
    sentEmails.length = 0;
    let response = makeResponse();
    await auth.forgotPassword(request({ email: "unknown@example.com" }), response);
    assert.equal(response.statusCode, 200);
    assert.equal(sentEmails.length, 0);

    response = makeResponse();
    await auth.forgotPassword(request({ email }), response);
    assert.equal(response.statusCode, 200);
    assert.equal(sentEmails.at(-1).to, email, "reset mail goes to the account email");
    const resetToken = sentEmails.at(-1).html.match(/reset-password\/([a-f0-9]{64})/)[1];
    assert.match(sentEmails.at(-1).html, /https:\/\/portfolio\.example\/reset-password\//);

    const expiredEmail = "expired-reset@example.com";
    const expiredToken = crypto.randomBytes(32).toString("hex");
    users.set(expiredEmail, { _id: String(++id), email: expiredEmail, resetPasswordToken: sha256(expiredToken), resetPasswordExpires: new Date(Date.now() - 1) });
    response = makeResponse();
    await auth.resetPassword(request({ password: "NewStrong2!" }, { token: expiredToken }), response);
    assert.equal(response.statusCode, 400, "expired reset authorization is rejected");

    response = makeResponse();
    await auth.resetPassword(request({ password: "Weakpass1" }, { token: "invalid" }), response);
    assert.equal(response.statusCode, 400);
    response = makeResponse();
    await auth.resetPassword(request({ password: "NewStrong2!" }, { token: resetToken }), response);
    assert.equal(response.statusCode, 200);
    const user = users.get(email);
    assert.equal(await bcrypt.compare("NewStrong2!", user.password), true);
    assert.equal(user.resetPasswordToken, undefined);
    response = makeResponse();
    await auth.resetPassword(request({ password: "NewStrong2!" }, { token: resetToken }), response);
    assert.equal(response.statusCode, 400);

    const loginResponse = makeResponse();
    await auth.loginUser(request({ email, password: "NewStrong2!" }), loginResponse);
    assert.equal(loginResponse.statusCode, 200);

    const failedEmail = "delivery-failure@example.com";
    const failedUser = { _id: String(++id), email: failedEmail, save: async function () { users.set(failedEmail, this); } };
    users.set(failedEmail, failedUser);
    smtpFailure = Object.assign(new Error("mock auth failure"), { code: "EAUTH", command: "AUTH PLAIN", responseCode: 535 });
    response = makeResponse();
    await auth.forgotPassword(request({ email: failedEmail }), response);
    smtpFailure = null;
    assert.equal(response.statusCode, 503, "failed email delivery is not reported as successful");
    assert.equal(failedUser.resetPasswordToken, undefined, "failed delivery clears the unusable reset token");
});

test("signup OTP request reports SMTP failure and removes the unusable OTP", async () => {
    smtpFailure = Object.assign(new Error("mock auth failure"), { code: "EAUTH", command: "AUTH PLAIN", responseCode: 535 });
    const response = makeResponse();
    await auth.requestSignupOtp(request({ email: "otp-delivery-failure@example.com" }), response);
    smtpFailure = null;
    assert.equal(response.statusCode, 503);
    assert.equal(records.has("otp-delivery-failure@example.com"), false);
});
