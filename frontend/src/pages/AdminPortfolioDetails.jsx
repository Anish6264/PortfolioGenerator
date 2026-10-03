import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../services/api";
import "./AdminPortfolioDetails.css";

const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const display = (value) => value === undefined || value === null || value === "" ? "—" : value;

function AdminPortfolioDetails() {
    const { id } = useParams();
    const [portfolio, setPortfolio] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        api.get("/admin/portfolios/" + encodeURIComponent(id))
            .then((response) => { if (active) setPortfolio(response.data.portfolio); })
            .catch((requestError) => {
                if (!active) return;
                const code = requestError.response?.status;
                setError(code === 400 ? "This portfolio ID is invalid."
                    : code === 404 ? "Portfolio not found."
                        : code === 401 ? "Your session is no longer valid. Please sign in again."
                            : code === 403 ? "Admin access is required to view portfolios."
                                : "Portfolio details could not be loaded. Please try again.");
            })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [id]);

    return (
        <main className="admin-portfolio-detail">
            <header className="admin-portfolio-detail-header">
                <div><p><Link to="/admin/portfolios">← Back to Portfolios</Link></p><h1>Portfolio Details</h1></div>
                <nav aria-label="Admin navigation">
                    <Link to="/admin">Dashboard</Link><Link to="/admin/users">Users</Link>
                    <Link to="/admin/payments">Payments</Link><Link to="/admin/credit-transactions">Credit Transactions</Link>
                    <Link to="/admin/portfolios" aria-current="page">Portfolios</Link><Link to="/admin/templates">Templates</Link>
                </nav>
            </header>
            {loading && <p role="status">Loading portfolio details…</p>}
            {error && <p className="admin-portfolio-detail-error" role="alert">{error}</p>}
            {portfolio && <>
                <section className="admin-portfolio-section"><h2>Portfolio</h2><dl className="admin-portfolio-grid">
                    <div><dt>Name</dt><dd>{display(portfolio.portfolioSummary?.name)}</dd></div>
                    <div><dt>Title</dt><dd>{display(portfolio.portfolioSummary?.title)}</dd></div>
                    <div><dt>Status</dt><dd>{portfolio.status}</dd></div>
                    <div><dt>Created</dt><dd>{formatDate(portfolio.createdAt)}</dd></div>
                    <div><dt>Updated</dt><dd>{formatDate(portfolio.updatedAt)}</dd></div>
                    <div><dt>Portfolio ID</dt><dd>{portfolio.id}</dd></div>
                </dl>
                {portfolio.portfolioSummary?.shortIntro && <div className="admin-portfolio-text-summary"><h3>Short introduction summary</h3><p>{portfolio.portfolioSummary.shortIntro}</p></div>}
                {portfolio.portfolioSummary?.about && <div className="admin-portfolio-text-summary"><h3>About summary</h3><p>{portfolio.portfolioSummary.about}</p></div>}
                </section>

                <section className="admin-portfolio-section"><h2>Owner account</h2>{portfolio.owner ? <dl className="admin-portfolio-grid">
                    <div><dt>Name</dt><dd>{display(portfolio.owner.name)}</dd></div><div><dt>Email</dt><dd>{display(portfolio.owner.email)}</dd></div><div><dt>Account ID</dt><dd>{portfolio.owner.id}</dd></div>
                </dl> : <p>The owner account is unavailable.</p>}</section>

                <section className="admin-portfolio-section"><h2>Saved portfolio identity</h2><dl className="admin-portfolio-grid">
                    <div><dt>Name</dt><dd>{display(portfolio.portfolioSummary?.name)}</dd></div>
                    <div><dt>Title</dt><dd>{display(portfolio.portfolioSummary?.title)}</dd></div>
                    <div><dt>Email</dt><dd>{display(portfolio.portfolioSummary?.email)}</dd></div>
                </dl></section>

                <section className="admin-portfolio-section"><h2>Template</h2>{portfolio.template ? <dl className="admin-portfolio-grid">
                    <div><dt>Name</dt><dd>{portfolio.template.name}</dd></div><div><dt>Category</dt><dd>{portfolio.template.category}</dd></div>
                    <div><dt>Tier</dt><dd>{portfolio.template.isPremium ? "Premium" : "Standard"}</dd></div><div><dt>Download cost</dt><dd>{portfolio.template.creditCost} credits</dd></div>
                    <div><dt>Template ID</dt><dd>{portfolio.template.id}</dd></div>
                </dl> : <p>The template is unavailable.</p>}</section>

                {portfolio.status === "published" && portfolio.publicUrl && <section className="admin-portfolio-section"><h2>Public portfolio</h2>
                    <p><a href={portfolio.publicUrl} target="_blank" rel="noopener noreferrer">View public portfolio</a></p>
                    <dl className="admin-portfolio-grid"><div><dt>Slug</dt><dd>{decodeURIComponent(portfolio.publicUrl.split("/").pop())}</dd></div><div><dt>Public path</dt><dd>{portfolio.publicUrl}</dd></div></dl>
                </section>}

                <section className="admin-portfolio-section"><h2>Content summary</h2><dl className="admin-portfolio-grid">
                    {Object.entries(portfolio.contentCounts || {}).map(([key, value]) => <div key={key}><dt>{key[0].toUpperCase() + key.slice(1)}</dt><dd>{value}</dd></div>)}
                </dl></section>

                <section className="admin-portfolio-section"><h2>Customization</h2><dl className="admin-portfolio-grid">
                    <div><dt>Font</dt><dd>{display(portfolio.customization?.fontFamily)}</dd></div>
                    {Object.entries(portfolio.customization?.colors || {}).map(([key, value]) => <div key={key}><dt>{key[0].toUpperCase() + key.slice(1)} color</dt><dd>{display(value)}</dd></div>)}
                    <div><dt>Visible sections</dt><dd>{Object.entries(portfolio.customization?.sectionVisibility || {}).filter(([, visible]) => visible).map(([name]) => name).join(", ") || "None"}</dd></div>
                    <div><dt>Section order</dt><dd>{portfolio.customization?.sectionOrder?.join(" → ") || "—"}</dd></div>
                    <div><dt>Custom section count</dt><dd>{portfolio.contentCounts?.customSections ?? 0}</dd></div>
                </dl></section>

                <section className="admin-portfolio-section"><h2>Download version</h2><dl className="admin-portfolio-grid">
                    <div><dt>Current content version</dt><dd>{portfolio.download.contentVersion}</dd></div>
                    <div><dt>Paid download version</dt><dd>{portfolio.download.paidDownloadVersion}</dd></div>
                    <div><dt>Current version payment</dt><dd>{portfolio.download.downloadPaid ? "Paid" : "Unpaid"}</dd></div>
                    <div><dt>Requires payment to download</dt><dd>{portfolio.download.requiresPayment ? "Yes" : "No"}</dd></div>
                    <div><dt>Current template cost</dt><dd>{portfolio.download.currentDownloadCost === null ? "Unavailable" : `${portfolio.download.currentDownloadCost} credits`}</dd></div>
                </dl></section>

                <section className="admin-portfolio-section"><h2>Credit activity</h2>
                    {portfolio.creditActivity.length === 0 ? <p>No portfolio-linked download or refund transactions.</p> : <div className="admin-portfolio-table-wrap"><table>
                        <thead><tr><th>Date</th><th>Type</th><th>Direction</th><th>Credits</th><th>Balance</th><th>Status</th></tr></thead>
                        <tbody>{portfolio.creditActivity.map((item) => <tr key={item.id}>
                            <td>{formatDate(item.createdAt)}</td><td>{item.type}</td><td>{item.direction}</td>
                            <td>{item.direction === "CREDIT" ? "+" : "−"}{item.amount}</td><td>{item.balanceBefore} → {item.balanceAfter}</td><td>{item.status}</td>
                        </tr>)}</tbody>
                    </table></div>}
                </section>
            </>}
        </main>
    );
}

export default AdminPortfolioDetails;
