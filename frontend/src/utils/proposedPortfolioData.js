const rootFields = new Set(["personal", "shortIntro", "about", "skills", "education", "experience", "projects", "social"]);
const personalFields = new Set(["name", "title", "email", "phone", "location"]);
const socialFields = new Set(["github", "linkedin", "twitter"]);
const objectArrayFields = {
    education: new Set(["degree", "institution", "startYear", "endYear", "description"]),
    experience: new Set(["company", "role", "startDate", "endDate", "description"]),
    projects: new Set(["title", "description", "technologies", "liveUrl", "githubUrl"])
};

const validExternalUrl = (value) => {
    if (!value) return true;
    try {
        return ["http:", "https:"].includes(new URL(value.trim()).protocol);
    } catch {
        return false;
    }
};

const validateProposedPortfolioData = (data) => {
    if (!data || typeof data !== "object" || Array.isArray(data)) return "Imported data must be an object";
    if (Object.keys(data).some((key) => !rootFields.has(key))) return "Imported data contains unsupported fields";

    for (const [objectName, allowedFields] of [["personal", personalFields], ["social", socialFields]]) {
        if (data[objectName] === undefined) continue;
        const value = data[objectName];
        if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !allowedFields.has(key))) {
            return `Imported ${objectName} data is invalid`;
        }
        for (const [key, field] of Object.entries(value)) {
            const maxLength = objectName === "personal"
                ? ({ name: 100, title: 120, email: 254, phone: 100, location: 150 }[key] || 2000)
                : 2048;
            if (typeof field !== "string" || field.length > maxLength) return `Imported ${objectName}.${key} must be short text`;
            if (objectName === "personal" && ["name", "title", "email"].includes(key) && !field.trim()) {
                return `Imported personal.${key} cannot be empty`;
            }
            if (objectName === "personal" && key === "email" && field.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.trim())) {
                return "Imported email is invalid";
            }
            if (objectName === "social" && !validExternalUrl(field)) return "Imported social links must use HTTP or HTTPS";
        }
    }

    for (const field of ["shortIntro", "about"]) {
        if (data[field] !== undefined && (typeof data[field] !== "string" || data[field].length > 4000)) {
            return `Imported ${field} must be text within the allowed length`;
        }
    }

    if (data.skills !== undefined && (!Array.isArray(data.skills) || data.skills.length > 100 || data.skills.some((item) => typeof item !== "string" || item.length > 100))) {
        return "Imported skills must be a list of short text values";
    }

    for (const [field, allowedFields] of Object.entries(objectArrayFields)) {
        if (data[field] === undefined) continue;
        if (!Array.isArray(data[field]) || data[field].length > 50) return `Imported ${field} must be a list`;
        for (const entry of data[field]) {
            if (!entry || typeof entry !== "object" || Array.isArray(entry) || Object.keys(entry).some((key) => !allowedFields.has(key))) {
                return `Imported ${field} entry is invalid`;
            }
            for (const [key, value] of Object.entries(entry)) {
                if (key === "technologies") {
                    if (!Array.isArray(value) || value.length > 30 || value.some((item) => typeof item !== "string" || item.length > 100)) {
                        return "Imported technologies are invalid";
                    }
                } else if (typeof value !== "string" || value.length > (key === "description" ? 2000 : 300)) {
                    return `Imported ${field}.${key} must be text within the allowed length`;
                }
                if ((key === "liveUrl" || key === "githubUrl") && !validExternalUrl(value)) {
                    return "Imported project links must use HTTP or HTTPS";
                }
            }
        }
    }

    return null;
};

const projectIdentity = (project) => {
    const url = typeof project?.githubUrl === "string" ? project.githubUrl.trim().toLowerCase().replace(/\/$/, "") : "";
    if (url) return `url:${url}`;
    return `fallback:${String(project?.title || "").trim().toLowerCase()}|${String(project?.description || "").trim().toLowerCase()}`;
};

const mergeProposedPortfolioData = (current, proposed, selectedFields = {}, selectedArrays = {}, replacements = {}, selectedReplacements = {}, repositoryProjects = []) => {
    const merged = {
        ...current,
        personal: { ...(current.personal || {}) },
        social: { ...(current.social || {}) }
    };

    for (const [field, value] of Object.entries(proposed.personal || {})) {
        if (selectedFields[`personal.${field}`] !== false) merged.personal[field] = value;
    }
    for (const [field, value] of Object.entries(proposed.social || {})) {
        if (selectedFields[`social.${field}`] !== false) merged.social[field] = value;
    }
    for (const field of ["shortIntro", "about"]) {
        if (proposed[field] !== undefined && selectedFields[field] !== false) merged[field] = proposed[field];
    }

    if (Array.isArray(proposed.skills)) {
        const additions = proposed.skills.filter((_, index) => selectedArrays.skills?.[index] !== false);
        const existing = Array.isArray(current.skills) ? current.skills : [];
        merged.skills = [...existing];
        for (const skill of additions) {
            if (!merged.skills.some((item) => typeof item === "string" && item.toLowerCase() === skill.toLowerCase())) merged.skills.push(skill);
        }
    }
    for (const field of Object.keys(objectArrayFields)) {
        if (Array.isArray(proposed[field])) {
            const additions = proposed[field].filter((_, index) => selectedArrays[field]?.[index] !== false);
            merged[field] = [...(Array.isArray(current[field]) ? current[field] : []), ...additions];
        }
    }
    if (repositoryProjects.length) {
        const projects = [...(Array.isArray(merged.projects) ? merged.projects : [])];
        const identities = new Set(projects.map(projectIdentity));
        for (const project of repositoryProjects) {
            const identity = projectIdentity(project);
            if (!identities.has(identity)) {
                projects.push(project);
                identities.add(identity);
            }
        }
        merged.projects = projects;
    }
    for (const [path, value] of Object.entries(replacements)) {
        if (selectedReplacements[path] === false) continue;
        const match = /^(experience|projects)\.(\d+)\.description$/.exec(path);
        if (!match || typeof value !== "string") continue;
        const [, section, index] = match;
        if (merged[section]?.[Number(index)]) {
            merged[section] = merged[section].map((item, itemIndex) =>
                itemIndex === Number(index) ? { ...item, description: value } : item
            );
        }
    }
    return merged;
};

export { validateProposedPortfolioData, mergeProposedPortfolioData, projectIdentity };
