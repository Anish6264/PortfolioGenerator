const path = require("path");
const fs = require("fs/promises");
const Portfolio = require("../models/Portfolio");
const { analyzeResumePdf } = require("./resumeAnalysis.provider");

const limits = {
    name: 100, title: 120, email: 254, phone: 100, location: 150,
    shortIntro: 1000, about: 4000
};
const MAX_RESUME_SIZE = 5 * 1024 * 1024;
const rowLimits = {
    education: { degree: 200, institution: 200, startYear: 30, endYear: 30, description: 2000 },
    experience: { company: 200, role: 200, startDate: 50, endDate: 50, description: 2000 },
    projects: { title: 120, description: 2000, liveUrl: 2048, githubUrl: 2048 }
};
const cleanText = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
const safeUrl = (value) => {
    const text = cleanText(value, 2048);
    if (!text) return "";
    try {
        const url = new URL(text);
        return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
};

// Converts untrusted parser/provider output into the existing Builder/Portfolio shape.
const normalizeResumeData = (input) => {
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const rawPersonal = source.personal && typeof source.personal === "object" && !Array.isArray(source.personal) ? source.personal : {};
    const personal = Object.fromEntries(Object.entries(limits).slice(0, 5).map(([field, max]) => [field, cleanText(rawPersonal[field], max)]));
    if (personal.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personal.email)) personal.email = "";
    const normalized = {
        personal,
        shortIntro: cleanText(source.shortIntro ?? source.content?.shortIntro, limits.shortIntro),
        about: cleanText(source.about ?? source.content?.about, limits.about),
        skills: Array.isArray(source.skills) ? source.skills.slice(0, 100).map((item) => cleanText(item, 100)).filter(Boolean) : [],
        education: [], experience: [], projects: [],
        social: { github: "", linkedin: "", twitter: "" }
    };
    for (const field of ["education", "experience", "projects"]) {
        const allowed = rowLimits[field];
        const rows = Array.isArray(source[field]) ? source[field].slice(0, 50) : [];
        normalized[field] = rows.filter((row) => row && typeof row === "object" && !Array.isArray(row)).map((row) => {
            const result = {};
            for (const [key, max] of Object.entries(allowed)) result[key] = ["liveUrl", "githubUrl"].includes(key) ? safeUrl(row[key]) : cleanText(row[key], max);
            if (field === "projects") result.technologies = Array.isArray(row.technologies)
                ? row.technologies.slice(0, 30).map((item) => cleanText(item, 100)).filter(Boolean) : [];
            return result;
        });
    }
    const socialSource = source.social && typeof source.social === "object" && !Array.isArray(source.social) ? source.social : {};
    for (const field of ["github", "linkedin", "twitter"]) normalized.social[field] = safeUrl(socialSource[field]);
    return normalized;
};

const extractResumeText = async () => ({ status: "not_configured", text: null });
const structureResumeText = async () => ({ status: "not_configured", data: null });

const normalizeResumeAnalysis = (input) => {
    const invalid = () => {
        const error = new Error("Resume analysis returned an invalid result. Please try again.");
        error.status = 502;
        error.code = "RESUME_ANALYSIS_INVALID_OUTPUT";
        return error;
    };
    const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
    const hasExactKeys = (value, keys) => isObject(value) &&
        Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
    const scalar = (value, max) => {
        if (typeof value !== "string" || value.length > max || /<\s*\/?\s*[a-z!][^>]*>/i.test(value)) throw invalid();
        return value.trim();
    };
    const list = (value, maxItems, itemMax) => {
        if (!Array.isArray(value) || value.length > maxItems) throw invalid();
        return value.map((item) => scalar(item, itemMax)).filter(Boolean);
    };
    const rows = (value, fields, fieldLimits, hasTechnologies = false) => {
        if (!Array.isArray(value) || value.length > 50) throw invalid();
        return value.map((row) => {
            const keys = hasTechnologies ? [...fields, "technologies"] : fields;
            if (!hasExactKeys(row, keys)) throw invalid();
            const result = {};
            for (const field of fields) result[field] = scalar(row[field], fieldLimits[field]);
            if (hasTechnologies) result.technologies = list(row.technologies, 30, 100);
            for (const urlField of ["liveUrl", "githubUrl"]) {
                if (Object.hasOwn(result, urlField)) result[urlField] = safeUrl(result[urlField]);
            }
            return result;
        }).filter((row) => Object.values(row).some((value) => Array.isArray(value) ? value.length : Boolean(value)));
    };

    const personalFields = ["name", "title", "email", "phone", "location"];
    const socialFields = ["github", "linkedin", "twitter"];
    const educationFields = ["degree", "institution", "startYear", "endYear", "description"];
    const experienceFields = ["company", "role", "startDate", "endDate", "description"];
    const projectFields = ["title", "description", "liveUrl", "githubUrl"];
    const rootFields = ["personal", "shortIntro", "about", "skills", "education", "experience", "projects", "social"];
    if (!hasExactKeys(input, rootFields) || !hasExactKeys(input.personal, personalFields) || !hasExactKeys(input.social, socialFields)) {
        throw invalid();
    }

    const personal = Object.fromEntries(personalFields.map((field) => [field, scalar(input.personal[field], limits[field])]));
    if (personal.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personal.email)) throw invalid();
    const social = Object.fromEntries(socialFields.map((field) => [field, safeUrl(scalar(input.social[field], 2048))]));
    const shortIntro = scalar(input.shortIntro, limits.shortIntro);
    const about = scalar(input.about, limits.about);
    const rawSkills = list(input.skills, 100, 100);
    const skills = [...new Map(rawSkills.map((skill) => [skill.toLocaleLowerCase(), skill])).values()];
    const education = rows(input.education, educationFields, rowLimits.education);
    const experience = rows(input.experience, experienceFields, rowLimits.experience);
    const projects = rows(input.projects, projectFields, rowLimits.projects, true);
    const seenProjects = new Set();
    const uniqueProjects = projects.filter((project) => {
        const identity = project.githubUrl
            ? `url:${project.githubUrl.toLowerCase().replace(/\/$/, "")}`
            : project.title
                ? `name:${project.title.toLocaleLowerCase()}`
                : `description:${project.description.toLocaleLowerCase()}`;
        if (seenProjects.has(identity)) return false;
        seenProjects.add(identity);
        return true;
    });

    const proposedData = {};
    const nonEmptyPersonal = Object.fromEntries(Object.entries(personal).filter(([, value]) => value));
    const nonEmptySocial = Object.fromEntries(Object.entries(social).filter(([, value]) => value));
    if (Object.keys(nonEmptyPersonal).length) proposedData.personal = nonEmptyPersonal;
    if (shortIntro) proposedData.shortIntro = shortIntro;
    if (about) proposedData.about = about;
    if (skills.length) proposedData.skills = skills;
    if (education.length) proposedData.education = education;
    if (experience.length) proposedData.experience = experience;
    if (uniqueProjects.length) proposedData.projects = uniqueProjects;
    if (Object.keys(nonEmptySocial).length) proposedData.social = nonEmptySocial;
    if (!Object.keys(proposedData).length) throw invalid();
    return proposedData;
};

const isValidPortfolioId = (id) => /^[a-f\d]{24}$/i.test(id || "");

const analyzePortfolioResume = async (portfolioId, userId) => {
    if (!isValidPortfolioId(portfolioId)) {
        const error = new Error("Invalid portfolio ID.");
        error.status = 400;
        error.code = "INVALID_PORTFOLIO_ID";
        throw error;
    }

    const portfolio = await Portfolio.findOne({ _id: portfolioId, user: userId }).select("resume");
    if (!portfolio) {
        const error = new Error("Portfolio not found.");
        error.status = 404;
        error.code = "PORTFOLIO_NOT_FOUND";
        throw error;
    }
    if (typeof portfolio.resume !== "string" || !portfolio.resume) {
        const error = new Error("Upload a PDF resume before analyzing it.");
        error.status = 400;
        error.code = "RESUME_NOT_FOUND";
        throw error;
    }

    const normalizedStoredPath = portfolio.resume.replaceAll("\\", "/");
    const storedPathMatch = /^uploads\/([A-Za-z0-9][A-Za-z0-9._-]*\.pdf)$/i.exec(normalizedStoredPath);
    if (!storedPathMatch) {
        const error = new Error("The stored resume is not a supported PDF. Upload it again.");
        error.status = 400;
        error.code = "INVALID_STORED_RESUME";
        throw error;
    }

    const uploadDirectory = path.resolve(__dirname, "../uploads");
    const candidatePath = path.resolve(uploadDirectory, storedPathMatch[1]);
    let realPath;
    let stats;
    try {
        realPath = await fs.realpath(candidatePath);
        const relativePath = path.relative(uploadDirectory, realPath);
        if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) throw new Error("invalid path");
        stats = await fs.stat(realPath);
    } catch {
        const error = new Error("The stored resume could not be found. Upload the PDF again.");
        error.status = 400;
        error.code = "RESUME_FILE_NOT_FOUND";
        throw error;
    }

    if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_RESUME_SIZE || path.extname(realPath).toLowerCase() !== ".pdf") {
        const error = new Error("The stored resume must be a PDF of 5 MB or smaller.");
        error.status = 400;
        error.code = "INVALID_STORED_RESUME";
        throw error;
    }

    let pdfBuffer;
    try {
        pdfBuffer = await fs.readFile(realPath);
    } catch {
        const error = new Error("The stored resume could not be found. Upload the PDF again.");
        error.status = 400;
        error.code = "RESUME_FILE_NOT_FOUND";
        throw error;
    }
    if (pdfBuffer.length < 5 || pdfBuffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
        const error = new Error("The stored resume is not a valid PDF. Upload it again.");
        error.status = 400;
        error.code = "INVALID_STORED_RESUME";
        throw error;
    }

    const analysis = await analyzeResumePdf(pdfBuffer, path.basename(realPath));
    return normalizeResumeAnalysis(analysis);
};

const parseResume = async (file) => {
    if (!file || file.mimetype !== "application/pdf" || path.extname(file.originalname || "").toLowerCase() !== ".pdf" || (Number.isFinite(file.size) && file.size > 5 * 1024 * 1024)) {
        const error = new Error("Upload a PDF resume of 5 MB or smaller");
        error.status = 400;
        throw error;
    }
    const extracted = await extractResumeText(file);
    if (extracted.status !== "ready" || typeof extracted.text !== "string") {
        return { status: "not_configured", proposedData: null, message: "Resume parsing is not configured yet. Your file was not imported." };
    }
    const structured = await structureResumeText(extracted.text);
    if (structured.status !== "ready") return { status: "not_configured", proposedData: null, message: "Resume parsing is not configured yet. Your file was not imported." };
    return { status: "ready", proposedData: normalizeResumeData(structured.data) };
};

module.exports = {
    parseResume,
    extractResumeText,
    structureResumeText,
    normalizeResumeData,
    normalizeResumeAnalysis,
    analyzePortfolioResume
};
