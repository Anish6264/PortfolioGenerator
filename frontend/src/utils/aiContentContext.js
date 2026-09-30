const allowedContext = {
    about: ["title", "skills"],
    shortIntro: ["title", "skills"],
    projectDescription: ["projectTitle", "technologies", "existingDescription"],
    experienceDescription: ["role", "title", "existingDescription", "skills"],
    skills: ["title", "skills"]
};

const buildAIRequest = (type, input, context = {}) => {
    const result = {};
    for (const key of allowedContext[type] || []) {
        const value = context[key];
        if (typeof value === "string") result[key] = value.slice(0, 500);
        else if (Array.isArray(value)) result[key] = value.filter((item) => typeof item === "string").slice(0, 30).map((item) => item.slice(0, 100));
    }
    return { type, input: typeof input === "string" ? input.slice(0, 4000) : "", context: result };
};

export default buildAIRequest;
