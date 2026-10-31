export const PASSWORD_REQUIREMENTS = [
    { key: "length", label: "At least 8 characters", test: (value) => value.length >= 8 },
    { key: "uppercase", label: "One uppercase letter", test: (value) => /[A-Z]/.test(value) },
    { key: "lowercase", label: "One lowercase letter", test: (value) => /[a-z]/.test(value) },
    { key: "number", label: "One number", test: (value) => /[0-9]/.test(value) },
    { key: "special", label: "One special character", test: (value) => /[^A-Za-z0-9]/.test(value) },
    { key: "byteLimit", label: "No more than 72 UTF-8 bytes", test: (value) => new TextEncoder().encode(value).length <= 72 }
];

export const isValidPassword = (value) => PASSWORD_REQUIREMENTS.every((rule) => rule.test(value));
