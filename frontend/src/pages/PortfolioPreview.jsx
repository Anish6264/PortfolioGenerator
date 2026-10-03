import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { downloadPortfolioZip } from "../utils/downloadPortfolio";
import { getTemplateGenerationCost } from "../utils/templatePricing";

const getPreviewError = (error) => {
    const status = error.response?.status;
    if (status === 400) return "This portfolio link is invalid.";
    if (status === 401) return "Your session has expired. Please sign in again.";
    if (status === 403) return "You do not have access to this portfolio.";
    if (status === 404) return "Portfolio not found, or you do not have access to it.";
    return "The portfolio preview could not be loaded. Please try again.";
};

function PortfolioPreview() {
    const { id } = useParams();
    const location = useLocation();
    const { user, refreshUser } = useAuth();
    const [portfolio, setPortfolio] = useState(null);
    const [html, setHtml] = useState("");
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState("");
    const [downloadMessage, setDownloadMessage] = useState("");
    const [downloadError, setDownloadError] = useState("");
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        let active = true;
        const fetchPreview = async () => {
            if (!active) return;
            setLoading(true);
            setError("");
            try {
                if (!/^[a-f\d]{24}$/i.test(id || "")) {
                    setError("This portfolio link is invalid.");
                    return;
                }
                const [portfolioResponse, previewResponse] = await Promise.all([
                    api.get(`/portfolios/${id}`),
                    api.get(`/generator/${id}/preview`)
                ]);
                if (active) {
                    setPortfolio(portfolioResponse.data.portfolio);
                    setHtml(previewResponse.data.html);
                }
            } catch (requestError) {
                if (active) setError(getPreviewError(requestError));
            } finally {
                if (active) setLoading(false);
            }
        };

        void Promise.resolve().then(fetchPreview);
        return () => {
            active = false;
        };
    }, [id, retryCount]);

    const handleDownload = async () => {
        if (downloading || !portfolio) return;
        setDownloading(true);
        setDownloadError("");
        setDownloadMessage("");

        try {
            await downloadPortfolioZip(portfolio);
            const [portfolioResult, userResult] = await Promise.allSettled([
                api.get(`/portfolios/${id}`).then((response) => setPortfolio(response.data.portfolio)),
                refreshUser()
            ]);
            setDownloadMessage("Your portfolio download has started.");
            if (portfolioResult.status === "rejected" || userResult.status === "rejected") {
                setDownloadError("The ZIP was created, but the latest portfolio or credit balance could not be refreshed.");
            }
        } catch (requestError) {
            let body = requestError.response?.data;
            if (body instanceof Blob) {
                try {
                    body = JSON.parse(await body.text());
                } catch {
                    body = {};
                }
            }

            if (body?.code === "INSUFFICIENT_CREDITS") {
                setDownloadError(`This download needs ${body.requiredCredits} credits. Your balance is ${body.availableCredits}.`);
            } else if (body?.code === "DOWNLOAD_IN_PROGRESS") {
                setDownloadError("A first download is already in progress. Please wait and try again.");
            } else if (body?.code === "PORTFOLIO_CHANGED") {
                setDownloadError("This portfolio changed before the download started. Refresh the preview and try again.");
            } else if (requestError.response?.status === 401) {
                setDownloadError("Your session has expired. Please sign in again.");
            } else if (requestError.response?.status === 403) {
                setDownloadError("You do not have access to this portfolio.");
            } else if (requestError.response?.status === 404) {
                setDownloadError("The portfolio or its selected template could not be found.");
            } else {
                setDownloadError("The download could not be completed. Please try again.");
            }

            await Promise.allSettled([
                api.get(`/portfolios/${id}`).then((response) => setPortfolio(response.data.portfolio)),
                refreshUser()
            ]);
        } finally {
            setDownloading(false);
        }
    };

    if (loading) {
        return <main><h2>Loading portfolio preview…</h2></main>;
    }

    if (error || !portfolio) {
        return (
            <main>
                <h1>Unable to load preview</h1>
                <p role="alert">{error || "The portfolio preview could not be loaded."}</p>
                <Link to="/dashboard">Back to Dashboard</Link>
                {location.state?.fromBuilder && <p><Link to={`/builder/edit/${id}`}>Back to Builder</Link></p>}
                <button type="button" onClick={() => { setLoading(true); setRetryCount((count) => count + 1); }}>Try again</button>
            </main>
        );
    }

    const template = portfolio.template;
    const hasTemplatePricing = template && typeof template.isPremium === "boolean";
    const cost = hasTemplatePricing ? getTemplateGenerationCost(template) : null;
    const isPaid = portfolio.downloadPaid === true;
    const insufficientCredits = !isPaid && Number.isInteger(cost) && Number.isInteger(user?.credits) && user.credits < cost;
    const editPath = `/builder/edit/${id}`;

    return (
        <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", borderBottom: "1px solid #ddd" }}>
                <Link to="/dashboard">Back to Dashboard</Link>
                {location.state?.fromBuilder && <Link to={editPath}>Back to Builder</Link>}
                <h1 style={{ fontSize: "1.25rem", margin: "0 auto 0 0.5rem" }}>Portfolio Preview</h1>
                <Link to={editPath}>Edit Portfolio</Link>
                <button type="button" onClick={handleDownload} disabled={downloading || (!isPaid && (!Number.isInteger(cost) || insufficientCredits))}>
                    {downloading
                        ? "Preparing download…"
                        : isPaid
                            ? "Download Again — Free"
                            : `Download — ${Number.isInteger(cost) ? `${cost} credit${cost === 1 ? "" : "s"}` : "cost unavailable"}`}
                </button>
            </header>

            <section aria-live="polite" style={{ padding: "0.25rem 1rem" }}>
                {!isPaid && Number.isInteger(cost) && <p>{cost} credit{cost === 1 ? "" : "s"} on first download.</p>}
                {isPaid && <p>First download paid — this version is free to download again.</p>}
                {insufficientCredits && (
                    <p role="status">You have {user.credits} credits; this download needs {cost}. <Link to="/buy-credits">Buy credits</Link></p>
                )}
                {downloadMessage && <p role="status">{downloadMessage}</p>}
                {downloadError && <p role="alert">{downloadError}</p>}
            </section>

            <iframe
                title="Generated portfolio preview"
                srcDoc={html}
                sandbox="allow-scripts"
                referrerPolicy="no-referrer"
                style={{ width: "100%", flex: 1, minHeight: "70vh", border: 0, background: "white" }}
            />
        </main>
    );
}

export default PortfolioPreview;
