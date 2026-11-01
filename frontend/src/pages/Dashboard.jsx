import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
import TemplatePricing from "../components/TemplatePricing";
import { getTemplateGenerationCost } from "../utils/templatePricing";
import { downloadPortfolioZip } from "../utils/downloadPortfolio";
import "./Dashboard.css";

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
    const [actionFeedback, setActionFeedback] = useState("");
    const [duplicatingId, setDuplicatingId] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const deleteDialogRef = useRef(null);

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

    const publishedCount = portfolios.filter((portfolio) => portfolio.status === "published").length;
    const draftCount = portfolios.length - publishedCount;

    useEffect(() => {
        const dialog = deleteDialogRef.current;
        if (!dialog) return;
        if (deleteTarget && !dialog.open) dialog.showModal();
        if (!deleteTarget && dialog.open) dialog.close();
    }, [deleteTarget]);


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

    const handleDelete = (portfolio) => setDeleteTarget(portfolio);

    const confirmDelete = async () => {
        const portfolioId = deleteTarget?._id;
        if (!portfolioId || deletingId) return;
        setDeletingId(portfolioId);

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
            setDeleteTarget(null);

        } catch (error) {

            console.error(error);

            setError(
                error.response?.data?.message ||
                "Failed to delete portfolio"
            );
        } finally {
            setDeletingId(null);
        }
    };

    const handleDuplicate = async (portfolioId) => {
        if (duplicatingId) return;
        setDuplicatingId(portfolioId);
        try {
            setError("");
            setActionFeedback("");
            const response = await api.post(
                `/portfolios/${portfolioId}/duplicate`
            );
            setPortfolios((previous) => [
                response.data.portfolio,
                ...previous
            ]);
            setActionFeedback("Portfolio duplicated successfully.");
        } catch (error) {
            console.error(error);
            setError(
                error.response?.data?.message ||
                "Failed to duplicate portfolio"
            );
        } finally {
            setDuplicatingId(null);
        }
    };

    const handleStatusChange = async (portfolio) => {
        const nextStatus = portfolio.status === "published"
            ? "draft"
            : "published";

        try {
            setUpdatingId(portfolio._id);
            setError("");
            setActionFeedback("");
            const response = await api.patch(
                `/portfolios/${portfolio._id}/status`,
                { status: nextStatus }
            );
            setPortfolios((previous) => previous.map((item) =>
                item._id === portfolio._id
                    ? response.data.portfolio
                    : item
            ));
            setActionFeedback(nextStatus === "published" ? "Portfolio published." : "Portfolio unpublished.");
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
            <main className="dashboard-page dashboard-loading">
                <span className="dashboard-loader" aria-hidden="true" />
                <h2 role="status" aria-busy="true">Loading your workspace…</h2>
            </main>
        );
    }


    // --------------------------------------------------
    // Dashboard
    // --------------------------------------------------

    return (
        <main className="dashboard-page">
            <header className="dashboard-header">
                <div className="dashboard-welcome">
                    <p className="dashboard-eyebrow">Your workspace</p>
                    <h1>Welcome, {user?.name}</h1>
                    <p className="dashboard-header-lede">Manage your portfolios and keep your best work up to date.</p>
                    {user?.role === "admin" && <p className="dashboard-admin-links"><Link to="/admin">Admin dashboard</Link><span aria-hidden="true">·</span><Link to="/admin/templates">Manage templates</Link></p>}
                </div>
                <div className="dashboard-header-actions">
                    <Link className="dashboard-button dashboard-button-primary" to="/professions">＋ Create portfolio</Link>
                    <Link className="dashboard-button dashboard-button-secondary" to="/credits">{user?.credits ?? 0} credits · Billing</Link>
                    <Link className="dashboard-text-link" to="/profile">Account settings</Link>
                    <button className="dashboard-button dashboard-button-quiet" onClick={handleLogout}>Log out</button>
                </div>
            </header>

            <section className="dashboard-summary" aria-label="Portfolio summary">
                <article><span>Portfolios</span><strong>{portfolios.length}</strong><small>In your workspace</small></article>
                <article><span>Published</span><strong>{publishedCount}</strong><small>Visible to visitors</small></article>
                <article><span>Drafts</span><strong>{draftCount}</strong><small>Ready when you are</small></article>
                <article className="dashboard-credit-card"><span>Available credits</span><strong>{user?.credits ?? 0}</strong><Link to="/buy-credits">Get more credits <span aria-hidden="true">→</span></Link></article>
            </section>

            <section className="dashboard-portfolio-section" aria-labelledby="dashboard-portfolios-title">
                <div className="dashboard-section-heading"><div><p className="dashboard-eyebrow">Your work, in one place</p><h2 id="dashboard-portfolios-title">My portfolios</h2></div><span>{filteredPortfolios.length} shown</span></div>
                {actionFeedback && <p className="dashboard-notice dashboard-notice-success" role="status">{actionFeedback}</p>}
                <div className="dashboard-controls">
                    <label>Analytics period
                        <select value={analyticsRange} onChange={(event) => handleAnalyticsRangeChange(event.target.value)}>
                            <option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="all">All time</option>
                        </select>
                    </label>
                    <div className="dashboard-filters">
                        <label>Search by name or title<input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></label>
                        <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All</option><option value="draft">Draft</option><option value="published">Published</option></select></label>
                        {templateNames.length > 0 && <label>Template<select value={templateFilter} onChange={(event) => setTemplateFilter(event.target.value)}><option value="all">All templates</option>{templateNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>}
                    </div>
                </div>

                {error && <p className="dashboard-notice dashboard-notice-error" role="alert">{error}</p>}
                {portfolios.length === 0 ? (
                    <div className="dashboard-empty-state"><span className="dashboard-empty-icon" aria-hidden="true">✦</span><h3>Your first portfolio starts here</h3><p>Create a portfolio, add your experience, and share your work with the world.</p><Link className="dashboard-button dashboard-button-primary" to="/professions">Create your first portfolio</Link></div>
                ) : (
                    <div className="dashboard-portfolio-grid">
                        {filteredPortfolios.map((portfolio) => (
                            <article className="dashboard-portfolio-card" key={portfolio._id}>
                                <div className="dashboard-card-heading">
                                    <div><p className="dashboard-eyebrow">{portfolio.template?.name || "Portfolio"}</p><h3>{portfolio.personal?.name}</h3><p>{portfolio.personal?.title}</p></div>
                                    <span className={`dashboard-status dashboard-status-${portfolio.status || "draft"}`}><span aria-hidden="true" />{portfolio.status === "published" ? "Published" : "Draft"}</span>
                                </div>
                                <TemplatePricing template={portfolio.template} />
                                <p className="dashboard-template-name">Template: {portfolio.template?.name || "Unknown Template"}</p>
                                <div className="dashboard-card-analytics">
                                    <button className="dashboard-button dashboard-button-secondary" type="button" onClick={() => handleAnalytics(portfolio._id)} disabled={analyticsLoadingId === portfolio._id || analyticsLoadingId === "all"}>
                                        {analyticsLoadingId === portfolio._id ? <><span className="dashboard-spinner" aria-hidden="true" />Loading analytics…</> : "View analytics"}
                                    </button>
                                    {analyticsById[portfolio._id] && <p role="status">Views: {analyticsById[portfolio._id].views} · Resume clicks: {analyticsById[portfolio._id].resumeClicks} · Project clicks: {analyticsById[portfolio._id].projectClicks}</p>}
                                </div>
                                {portfolio.status === "published" && portfolio.slug && (
                                    <div className="dashboard-public-link">
                                        <label>Public URL<input type="url" readOnly value={`${window.location.origin}/p/${portfolio.slug}`} aria-label={`Public URL for ${portfolio.personal?.name || "portfolio"}`} /></label>
                                        <div><button className="dashboard-button dashboard-button-secondary" type="button" onClick={() => copyPublicLink(portfolio.slug)}>Copy link</button><a href={`/p/${portfolio.slug}`} target="_blank" rel="noopener noreferrer">Open public page</a></div>
                                        {shareFeedback.slug === portfolio.slug && <span role="status">{shareFeedback.message}</span>}
                                    </div>
                                )}
                                <div className="dashboard-card-actions">
                                    <Link className="dashboard-button dashboard-button-secondary" to={`/builder/edit/${portfolio._id}`}>Edit</Link>
                                    <button className="dashboard-button dashboard-button-secondary" type="button" onClick={() => handleDuplicate(portfolio._id)} disabled={Boolean(duplicatingId)}>{duplicatingId === portfolio._id ? <><span className="dashboard-spinner" aria-hidden="true" />Duplicating…</> : "Duplicate"}</button>
                                    <button className="dashboard-button dashboard-button-secondary" type="button" onClick={() => handleStatusChange(portfolio)} disabled={updatingId === portfolio._id}>
                                        {updatingId === portfolio._id ? "Updating…" : portfolio.status === "published" ? "Unpublish" : "Publish"}
                                    </button>
                                    <Link className="dashboard-button dashboard-button-secondary" to={`/portfolio/${portfolio._id}/preview`}>Preview</Link>
                                    <button className="dashboard-button dashboard-button-primary dashboard-download-button" type="button" onClick={() => handleGenerate(portfolio)} disabled={generatingId !== null || (portfolio.downloadPaid !== true && (!Number.isInteger(getTemplateGenerationCost(portfolio.template)) || (user?.credits ?? 0) < getTemplateGenerationCost(portfolio.template)))} title={portfolio.downloadPaid === true ? "First download paid; future downloads are free" : `${getTemplateGenerationCost(portfolio.template)} credits on first download; balance: ${user?.credits ?? 0}`}>
                                        {generatingId === portfolio._id ? <><span className="dashboard-spinner" aria-hidden="true" />Generating…</> : portfolio.downloadPaid === true ? "Download again · Free" : `Download · ${getTemplateGenerationCost(portfolio.template) ?? "unavailable"} credits`}
                                    </button>
                                    <button className="dashboard-button dashboard-button-danger" type="button" onClick={() => handleDelete(portfolio)} disabled={Boolean(deletingId)}>Delete</button>
                                </div>
                                <p className="dashboard-download-note">{portfolio.downloadPaid === true ? "First download paid — this download is free" : `${getTemplateGenerationCost(portfolio.template) ?? "unavailable"} credits on first download`}</p>
                            </article>
                        ))}
                        {filteredPortfolios.length === 0 && <p className="dashboard-empty-filter">No portfolios match these filters. Adjust your search or filters above.</p>}
                    </div>
                )}
            </section>

            <dialog className="dashboard-delete-dialog" ref={deleteDialogRef} aria-labelledby="dashboard-delete-title" onCancel={() => setDeleteTarget(null)}>
                <p className="dashboard-eyebrow">Delete portfolio</p><h2 id="dashboard-delete-title">Are you sure?</h2>
                <p>This will permanently delete <strong>{deleteTarget?.personal?.name || "this portfolio"}</strong> and its associated portfolio data.</p>
                {error && <p className="dashboard-notice dashboard-notice-error" role="alert">{error}</p>}
                <div className="dashboard-dialog-actions">
                    <button className="dashboard-button dashboard-button-secondary" type="button" onClick={() => setDeleteTarget(null)} disabled={Boolean(deletingId)}>Keep portfolio</button>
                    <button className="dashboard-button dashboard-button-danger" type="button" onClick={confirmDelete} disabled={Boolean(deletingId)}>{deletingId ? <><span className="dashboard-spinner" aria-hidden="true" />Deleting…</> : "Delete permanently"}</button>
                </div>
            </dialog>
        </main>
    );
}

export default Dashboard;
