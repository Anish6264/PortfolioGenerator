const PASSWORD_RULES = [
    { key: "length", test: (password) => password.length >= 8, message: "At least 8 characters" },
    { key: "uppercase", test: (password) => /[A-Z]/.test(password), message: "One uppercase letter" },
    { key: "lowercase", test: (password) => /[a-z]/.test(password), message: "One lowercase letter" },
    { key: "number", test: (password) => /[0-9]/.test(password), message: "One number" },
    { key: "special", test: (password) => /[^A-Za-z0-9]/.test(password), message: "One special character" },
    { key: "byteLimit", test: (password) => Buffer.byteLength(password, "utf8") <= 72, message: "No more than 72 UTF-8 bytes" }
];

const isValidPassword = (password) => typeof password === "string" && PASSWORD_RULES.every((rule) => rule.test(password));

module.exports = { PASSWORD_RULES, isValidPassword };
