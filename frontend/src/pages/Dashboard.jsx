import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
import TemplatePricing from "../components/TemplatePricing";
import { getTemplateGenerationCost } from "../utils/templatePricing";
import { downloadPortfolioZip } from "../utils/downloadPortfolio";

function Dashboard() {

    const navigate = useNavigate();

    const {
        user,
        logout,
        refreshUser
    } = useAuth();

    const [portfolios, setPortfolios] = useState([]);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState("");

    const [generatingId, setGeneratingId] =
        useState(null);

    const [searchTerm, setSearchTerm] = useState("");

    const [statusFilter, setStatusFilter] = useState("all");

    const [templateFilter, setTemplateFilter] = useState("all");

    const [updatingId, setUpdatingId] = useState(null);

    const [analyticsById, setAnalyticsById] = useState({});

    const [analyticsLoadingId, setAnalyticsLoadingId] = useState(null);
    const [analyticsRange, setAnalyticsRange] = useState("all");

    const [shareFeedback, setShareFeedback] = useState({ slug: "", message: "" });

    const generationLock = useRef(false);

    const copyPublicLink = async (slug) => {
        const publicUrl = `${window.location.origin}/p/${slug}`;
        try {
            if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
            await navigator.clipboard.writeText(publicUrl);
            setShareFeedback({ slug, message: "Public link copied." });
        } catch {
            setShareFeedback({ slug, message: "Could not access the clipboard. Select the URL to copy it." });
        }
    };

    const templateNames = Array.from(new Set(
        portfolios
            .map((portfolio) => portfolio.template?.name)
            .filter(Boolean)
    ));

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filteredPortfolios = portfolios.filter((portfolio) => {
        const matchesSearch = !normalizedSearch || [
            portfolio.personal?.name,
            portfolio.personal?.title
        ].some((value) => value?.toLowerCase().includes(normalizedSearch));
        const matchesStatus = statusFilter === "all" ||
            (portfolio.status || "draft") === statusFilter;
        const matchesTemplate = templateFilter === "all" ||
            portfolio.template?.name === templateFilter;

        return matchesSearch && matchesStatus && matchesTemplate;
    });


    // --------------------------------------------------
    // Fetch user's portfolios
    // --------------------------------------------------

    useEffect(() => {

        const fetchPortfolios = async () => {

            try {

                const response = await api.get(
                    "/portfolios"
                );

                setPortfolios(
                    response.data.portfolios
                );

            } catch (error) {

                console.error(error);

                setError(
                    error.response?.data?.message ||
                    "Failed to load portfolios"
                );

            } finally {

                setLoading(false);
            }
        };

        fetchPortfolios();

    }, []);


    // --------------------------------------------------
    // Delete portfolio
    // --------------------------------------------------

    const handleDelete = async (portfolioId) => {

        const confirmed = window.confirm(
            "Are you sure you want to delete this portfolio?"
        );

        if (!confirmed) {
            return;
        }

        try {

            setError("");

            await api.delete(
                `/portfolios/${portfolioId}`
            );

            setPortfolios((previous) =>
                previous.filter(
                    (portfolio) =>
                        portfolio._id !== portfolioId
                )
            );

        } catch (error) {

            console.error(error);

            setError(
                error.response?.data?.message ||
                "Failed to delete portfolio"
            );
        }
    };

    const handleDuplicate = async (portfolioId) => {
        try {
            setError("");
            const response = await api.post(
                `/portfolios/${portfolioId}/duplicate`
            );
            setPortfolios((previous) => [
                response.data.portfolio,
                ...previous
            ]);
        } catch (error) {
            console.error(error);
            setError(
                error.response?.data?.message ||
                "Failed to duplicate portfolio"
            );
        }
    };

    const handleStatusChange = async (portfolio) => {
        const nextStatus = portfolio.status === "published"
            ? "draft"
            : "published";

        try {
            setUpdatingId(portfolio._id);
            setError("");
            const response = await api.patch(
                `/portfolios/${portfolio._id}/status`,
                { status: nextStatus }
            );
            setPortfolios((previous) => previous.map((item) =>
                item._id === portfolio._id
                    ? response.data.portfolio
                    : item
            ));
        } catch (error) {
            console.error(error);
            setError(
                error.response?.data?.message ||
                "Failed to update portfolio status"
            );
        } finally {
            setUpdatingId(null);
        }
    };

    const handleAnalytics = async (portfolioId) => {
        try {
            setAnalyticsLoadingId(portfolioId);
            setError("");
            const response = await api.get(`/portfolios/${portfolioId}/analytics?range=${analyticsRange}`);
            setAnalyticsById((current) => ({ ...current, [portfolioId]: response.data }));
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Failed to load portfolio analytics");
        } finally {
            setAnalyticsLoadingId(null);
        }
    };

    const handleAnalyticsRangeChange = async (range) => {
        setAnalyticsRange(range);
        const portfolioIds = Object.keys(analyticsById);
        if (!portfolioIds.length) return;
        try {
            setAnalyticsLoadingId("all");
            const results = await Promise.all(portfolioIds.map(async (portfolioId) => {
                const response = await api.get(`/portfolios/${portfolioId}/analytics?range=${range}`);
                return [portfolioId, response.data];
            }));
            setAnalyticsById(Object.fromEntries(results));
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Failed to refresh portfolio analytics");
        } finally {
            setAnalyticsLoadingId(null);
        }
    };


    // --------------------------------------------------
    // Generate and download portfolio
    // --------------------------------------------------

    const handleGenerate = async (portfolio) => {
        if (generationLock.current) return;
        const downloadPaid = portfolio.downloadPaid === true;
        const generationCost = getTemplateGenerationCost(portfolio.template);
        if (!downloadPaid && (!Number.isInteger(generationCost) || generationCost < 1)) {
            setError("The first-download credit cost is unavailable. Please select another template or try again later.");
            return;
        }
        if (!downloadPaid && (user?.credits ?? 0) < generationCost) {
            setError(`You need ${generationCost} credits to generate this portfolio. You have ${user?.credits ?? 0}.`);
            return;
        }
        generationLock.current = true;
        const portfolioId = portfolio._id;

        try {

            setGeneratingId(portfolioId);

            setError("");

            await downloadPortfolioZip(portfolio);

            try {
                const portfoliosResponse = await api.get("/portfolios");
                setPortfolios(portfoliosResponse.data.portfolios);
            } catch (refreshError) {
                console.error("Failed to refresh portfolio download status:", refreshError);
            }

            try {
                await refreshUser();
            } catch (refreshError) {
                console.error("Failed to refresh user data:", refreshError);
            }

        } catch (error) {

            console.error(error);
            const status = error.response?.status;
            let errorBody = error.response?.data;
            if (errorBody instanceof Blob) {
                try {
                    errorBody = JSON.parse(await errorBody.text());
                } catch {
                    errorBody = {};
                }
            }
            const message = errorBody?.code === "INSUFFICIENT_CREDITS"
                ? `Insufficient credits. The first download needs ${errorBody.requiredCredits} credits; your balance is ${errorBody.availableCredits}.`
                : status === 401
                    ? "Your session has expired. Please sign in again."
                    : status === 403
                        ? "You do not have access to this portfolio."
                        : errorBody?.code === "TEMPLATE_NOT_FOUND"
                            ? "This template is unavailable. Select an active template before generating."
                            : errorBody?.code === "PORTFOLIO_NOT_FOUND" || status === 404
                                ? "The portfolio could not be found."
                            : status === 400
                                ? "This portfolio has invalid or incomplete data and could not be generated."
                                : "Portfolio generation failed. Please try again.";
            setError(message);
            try {
                const portfoliosResponse = await api.get("/portfolios");
                setPortfolios(portfoliosResponse.data.portfolios);
            } catch (refreshError) {
                console.error("Failed to refresh portfolio state after download failure:", refreshError);
            }
            try {
                await refreshUser();
            } catch (refreshError) {
                console.error("Failed to refresh user data:", refreshError);
            }

        } finally {

            generationLock.current = false;
            setGeneratingId(null);
        }
    };


    // --------------------------------------------------
    // Logout
    // --------------------------------------------------

    const handleLogout = () => {

        logout();

        navigate("/login");
    };


    // --------------------------------------------------
    // Loading
    // --------------------------------------------------

    if (loading) {

        return (
            <div>
                <h2>
                    Loading dashboard...
                </h2>
            </div>
        );
    }


    // --------------------------------------------------
    // Dashboard
    // --------------------------------------------------

    return (
        <div>

            {/* Header */}

            <header>

                <div>

                    <h1>
                        Welcome, {user?.name}
                    </h1>

                    <p>
                        Manage your portfolios
                    </p>

                    <p>
                        <Link to="/credits">Credits: {user?.credits ?? 0} · Billing history</Link>
                    </p>

                    <p><Link to="/buy-credits">Buy Credits</Link></p>

                    <Link to="/profile">Profile / Account</Link>
                    {user?.role === "admin" && (
                        <p><Link to="/admin">Admin Dashboard</Link>{" · "}<Link to="/admin/templates">Manage Templates</Link></p>
                    )}

                </div>


                <div>

                    <Link to="/professions">
                        + Create Portfolio
                    </Link>

                    {" "}

                    <button
                        onClick={handleLogout}
                    >
                        Logout
                    </button>

                </div>

            </header>


            {/* Main */}

            <main>

                <h2>
                    My Portfolios
                </h2>

                <label>
                    Analytics period{" "}
                    <select value={analyticsRange} onChange={(event) => handleAnalyticsRangeChange(event.target.value)}>
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="all">All time</option>
                    </select>
                </label>

                <div>
                    <label>
                        Search by name or title{" "}
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                    </label>

                    <label>
                        Status{" "}
                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                        >
                            <option value="all">All</option>
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                        </select>
                    </label>

                    {templateNames.length > 0 && (
                        <label>
                            Template{" "}
                            <select
                                value={templateFilter}
                                onChange={(event) => setTemplateFilter(event.target.value)}
                            >
                                <option value="all">All templates</option>
                                {templateNames.map((name) => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </label>
                    )}
                </div>


                {error && (
                    <p>{error}</p>
                )}


                {portfolios.length === 0 ? (

                    <div>

                        <p>
                            You haven't created any
                            portfolios yet.
                        </p>

                        <Link to="/professions">
                            Create Your First Portfolio
                        </Link>

                    </div>

                ) : (

                    <div>

                        {filteredPortfolios.map(
                            (portfolio) => (

                                <article
                                    key={
                                        portfolio._id
                                    }
                                >

                                    <h3>
                                        {
                                            portfolio
                                                .personal
                                                ?.name
                                        }
                                    </h3>

                                    <p>
                                        {
                                            portfolio
                                                .personal
                                                ?.title
                                        }
                                    </p>
                                    <TemplatePricing template={portfolio.template} />

                                    <p>
                                        Template:{" "}

                                        {
                                            portfolio
                                                .template
                                                ?.name ||
                                            "Unknown Template"
                                        }
                                    </p>

                                    <p>Status: {portfolio.status || "draft"}</p>
                                    <button
                                        type="button"
                                        onClick={() => handleAnalytics(portfolio._id)}
                                        disabled={analyticsLoadingId === portfolio._id || analyticsLoadingId === "all"}
                                    >
                                        {analyticsLoadingId === portfolio._id ? "Loading analytics..." : "Analytics"}
                                    </button>
                                    {analyticsById[portfolio._id] && (
                                        <p>
                                            Views: {analyticsById[portfolio._id].views} · Resume clicks: {analyticsById[portfolio._id].resumeClicks} · Project clicks: {analyticsById[portfolio._id].projectClicks}
                                        </p>
                                    )}
                                    {portfolio.status === "published" && portfolio.slug && (
                                        <p>
                                            Public page:{" "}
                                                <label>
                                                    Public URL{" "}
                                                    <input
                                                        type="url"
                                                        readOnly
                                                        value={`${window.location.origin}/p/${portfolio.slug}`}
                                                        aria-label={`Public URL for ${portfolio.personal?.name || "portfolio"}`}
                                                    />
                                                </label>{" "}
                                                <button type="button" onClick={() => copyPublicLink(portfolio.slug)}>Copy Link</button>{" "}
                                                <a href={`/p/${portfolio.slug}`} target="_blank" rel="noopener noreferrer">Open Public</a>
                                                {shareFeedback.slug === portfolio.slug && <span role="status"> {shareFeedback.message}</span>}
                                        </p>
                                    )}


                                    <div>

                                        {/* Edit */}

                                        <Link
                                            to={`/builder/edit/${portfolio._id}`}
                                        >
                                            Edit
                                        </Link>

                                        {" "}

                                        <button
                                            type="button"
                                            onClick={() => handleDuplicate(portfolio._id)}
                                        >
                                            Duplicate
                                        </button>

                                        {" "}

                                        <button
                                            type="button"
                                            onClick={() => handleStatusChange(portfolio)}
                                            disabled={updatingId === portfolio._id}
                                        >
                                            {updatingId === portfolio._id
                                                ? "Updating..."
                                                : portfolio.status === "published"
                                                    ? "Unpublish"
                                                    : "Publish"}
                                        </button>

                                        {" "}

<Link
    to={`/portfolio/${portfolio._id}/preview`}
>
    Preview
</Link>


                                        {" "}


                                        {/* Generate */}

                                        <button
                                            onClick={() => handleGenerate(portfolio)}
                                            disabled={
                                                generatingId !== null ||
                                                (portfolio.downloadPaid !== true && (
                                                    !Number.isInteger(getTemplateGenerationCost(portfolio.template)) ||
                                                    (user?.credits ?? 0) < getTemplateGenerationCost(portfolio.template)
                                                ))
                                            }
                                            title={portfolio.downloadPaid === true
                                                ? "First download paid; future downloads are free"
                                                : `${getTemplateGenerationCost(portfolio.template)} credits on first download; balance: ${user?.credits ?? 0}`}
                                        >
                                            {
                                                generatingId ===
                                                portfolio._id
                                                    ? "Generating..."
                                                    : portfolio.downloadPaid === true
                                                        ? "Download Again — Free"
                                                        : `Download Portfolio — ${getTemplateGenerationCost(portfolio.template) ?? "unavailable"} credits`
                                            }
                                        </button>

                                        <p>
                                            {portfolio.downloadPaid === true
                                                ? "First download paid — this download is free"
                                                : `${getTemplateGenerationCost(portfolio.template) ?? "unavailable"} credits on first download`}
                                        </p>


                                        {" "}


                                        {/* Delete */}

                                        <button
                                            onClick={() =>
                                                handleDelete(
                                                    portfolio._id
                                                )
                                            }
                                        >
                                            Delete
                                        </button>

                                    </div>

                                </article>
                            )
                        )}

                        {filteredPortfolios.length === 0 && (
                            <p>No portfolios match these filters.</p>
                        )}

                    </div>
                )}

            </main>

        </div>
    );
}

export default Dashboard;
