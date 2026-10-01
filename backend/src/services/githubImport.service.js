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

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_API_VERSION = "2026-03-10";
const REPOSITORIES_PER_PAGE = 100;
// Cap imports at 1,000 repositories to bound API calls and response size.
const MAX_REPOSITORY_PAGES = 10;
const GITHUB_REQUEST_TIMEOUT_MS = 10_000;

class GitHubImportError extends Error {
    constructor(message, { status = 502, code = "GITHUB_IMPORT_FAILED" } = {}) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

const githubRequest = async (path, query = {}) => {
    const url = new URL(path, GITHUB_API_BASE);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));

    const headers = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GITHUB_REQUEST_TIMEOUT_MS);

    let response;
    try {
        response = await fetch(url, { method: "GET", headers, signal: controller.signal });
    } catch (error) {
        const timedOut = error?.name === "AbortError";
        throw new GitHubImportError(
            timedOut ? "Unable to reach GitHub right now." : "Unable to reach GitHub right now.",
            { status: 503, code: timedOut ? "GITHUB_TIMEOUT" : "GITHUB_UNAVAILABLE" }
        );
    } finally {
        clearTimeout(timeout);
    }

    if (response.status === 404) {
        throw new GitHubImportError("GitHub user not found.", { status: 404, code: "GITHUB_USER_NOT_FOUND" });
    }
    if (response.status === 401) {
        throw new GitHubImportError("GitHub authentication failed. Check the server configuration.", { status: 502, code: "GITHUB_AUTH_FAILED" });
    }
    if (response.status === 403 || response.status === 429) {
        const rateLimited = response.status === 429 || response.headers.get("x-ratelimit-remaining") === "0" || Boolean(response.headers.get("retry-after"));
        throw new GitHubImportError(
            rateLimited ? "GitHub rate limit reached. Please try again later." : "GitHub import failed.",
            { status: rateLimited ? 429 : 502, code: rateLimited ? "GITHUB_RATE_LIMIT" : "GITHUB_FORBIDDEN" }
        );
    }
    if (!response.ok) {
        throw new GitHubImportError("GitHub import failed.", { status: 502, code: "GITHUB_API_ERROR" });
    }

    let data;
    try {
        data = await response.json();
    } catch {
        throw new GitHubImportError("GitHub returned an unexpected response.", { status: 502, code: "GITHUB_INVALID_RESPONSE" });
    }
    return data;
};

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

    if (typeof process.env.GITHUB_TOKEN !== "string" || !process.env.GITHUB_TOKEN.trim()) {
        return {
            status: "not_configured",
            username,
            proposedData: null,
            repositories: [],
            message: "GitHub import is not configured."
        };
    }

    const profile = await githubRequest(`/users/${encodeURIComponent(username)}`);
    if (!profile || typeof profile !== "object" || Array.isArray(profile) ||
        typeof profile.login !== "string" || typeof profile.html_url !== "string") {
        throw new GitHubImportError("GitHub returned an unexpected response.", { status: 502, code: "GITHUB_INVALID_RESPONSE" });
    }

    const profileProposal = mapGitHubProfileToPortfolio(profile);
    const repositories = [];
    for (let page = 1; page <= MAX_REPOSITORY_PAGES; page += 1) {
        const pageData = await githubRequest(`/users/${encodeURIComponent(username)}/repos`, {
            type: "owner",
            sort: "updated",
            per_page: REPOSITORIES_PER_PAGE,
            page
        });
        if (!Array.isArray(pageData)) {
            throw new GitHubImportError("GitHub returned an unexpected response.", { status: 502, code: "GITHUB_INVALID_RESPONSE" });
        }

        // Only public repositories belong in a portfolio proposal, even if this token can see private repositories.
        const publicRepositories = pageData.filter((repository) => repository && repository.private !== true);
        for (const repository of publicRepositories) {
            const project = mapRepositoryToProject(repository);
            if (!project.title || !project.githubUrl) continue;
            repositories.push(normalizeRepositoryProposal({
                name: project.title,
                description: project.description,
                technologies: project.technologies,
                githubUrl: project.githubUrl,
                liveUrl: project.liveUrl
            }));
        }

        if (pageData.length < REPOSITORIES_PER_PAGE) break;
    }

    const reviewedProjects = repositoriesToProjects(repositories, repositories);
    const repositoryProposals = reviewedProjects.map((project) => ({
        name: project.title,
        description: project.description,
        technologies: project.technologies,
        githubUrl: project.githubUrl,
        liveUrl: project.liveUrl,
        selected: true
    }));

    return {
        status: "ready",
        username: profile.login,
        proposedData: profileProposal.portfolioData,
        avatarUrl: profileProposal.avatarUrl,
        repositories: repositoryProposals,
        message: "GitHub profile and public repositories are ready for review."
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
