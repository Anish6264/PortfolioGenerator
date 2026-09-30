const normalizeGitHubReference = (reference) => {
    if (typeof reference !== "string" || !reference.trim() || reference.length > 300) return null;
    const value = reference.trim();
    if (/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(value)) return value;

    try {
        const parsed = new URL(value);
        if (
            parsed.protocol !== "https:" ||
            parsed.hostname.toLowerCase() !== "github.com" ||
            parsed.username ||
            parsed.password ||
            parsed.search ||
            parsed.hash
        ) return null;
        const segments = parsed.pathname.split("/").filter(Boolean);
        return segments.length === 1 && /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(segments[0])
            ? segments[0]
            : null;
    } catch {
        return null;
    }
};

const boundedText = (value, maxLength) =>
    typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const mapRepositoryToProject = (repository = {}) => {
    const source = repository && typeof repository === "object" && !Array.isArray(repository)
        ? repository
        : {};
    const language = boundedText(source.language, 100);
    return {
        title: boundedText(source.name, 120),
        description: boundedText(source.description, 2000),
        technologies: language ? [language] : [],
        githubUrl: normalizeProjectUrl(source.html_url),
        liveUrl: normalizeProjectUrl(source.homepage)
    };
};

const normalizeRepositoryProposal = (repository = {}) => {
    const source = repository && typeof repository === "object" && !Array.isArray(repository) ? repository : {};
    const project = mapRepositoryToProject({
        ...source,
        language: source.language || (Array.isArray(source.technologies) ? source.technologies[0] : ""),
        html_url: source.html_url || source.githubUrl,
        homepage: source.homepage || source.liveUrl
    });
    return {
        name: project.title,
        description: project.description,
        technologies: Array.isArray(source.technologies)
            ? source.technologies.slice(0, 30).map((value) => boundedText(value, 100)).filter(Boolean)
            : project.technologies,
        githubUrl: project.githubUrl,
        liveUrl: project.liveUrl,
        selected: true
    };
};

const repositoriesToProjects = (repositories, selected = []) => {
    const chosen = Array.isArray(selected) ? selected : [];
    return chosen.map((item) => typeof item === "number" ? repositories[item] : item)
        .filter((item) => item && item.selected !== false)
        .map((item) => ({
            title: boundedText(item.name, 120),
            description: boundedText(item.description, 2000),
            technologies: Array.isArray(item.technologies) ? item.technologies.slice(0, 30).map((value) => boundedText(value, 100)).filter(Boolean) : [],
            githubUrl: normalizeProjectUrl(item.githubUrl),
            liveUrl: normalizeProjectUrl(item.liveUrl)
        }));
};

const normalizeProjectUrl = (value) => {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
        const parsed = new URL(value.trim());
        return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
    } catch {
        return "";
    }
};

const mapGitHubProfileToPortfolio = (profile = {}) => {
    const source = profile && typeof profile === "object" && !Array.isArray(profile) ? profile : {};
    const username = normalizeGitHubReference(source.html_url || source.login);
    const portfolioData = {};
    const name = boundedText(source.name, 100);
    const bio = boundedText(source.bio, 4000);

    if (name) portfolioData.personal = { name };
    if (bio) portfolioData.about = bio;
    if (username) portfolioData.social = { github: `https://github.com/${username}` };

    return {
        portfolioData,
        avatarUrl: normalizeProjectUrl(source.avatar_url)
    };
};

const importGitHubProfile = async (reference) => {
    const username = normalizeGitHubReference(reference);
    if (!username) {
        const error = new Error("Enter a GitHub username or a github.com profile URL");
        error.status = 400;
        throw error;
    }

    return {
        status: "not_configured",
        username,
        proposedData: null,
        repositories: [],
        message: "GitHub import is not configured yet. No profile or repositories were fetched."
    };
};

module.exports = {
    normalizeGitHubReference,
    mapRepositoryToProject,
    normalizeRepositoryProposal,
    repositoriesToProjects,
    mapGitHubProfileToPortfolio,
    importGitHubProfile
};
