const path = require("path");

const limits = {
    name: 100, title: 120, email: 254, phone: 100, location: 150,
    shortIntro: 1000, about: 4000
};
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

module.exports = { parseResume, extractResumeText, structureResumeText, normalizeResumeData };
