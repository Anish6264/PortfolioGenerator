import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import api from "../services/api";
import "./CreditsBilling.css";

const FILTERS = [
    { value: "", label: "All activity" },
    { value: "PURCHASE", label: "Purchases" },
    { value: "DOWNLOAD", label: "Portfolio downloads" },
    { value: "GITHUB_IMPORT", label: "GitHub imports" },
    { value: "REFUND", label: "Refunds" }
];

const formatDate = (value) => new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
}).format(new Date(value));

function CreditsBilling() {
    const { user } = useAuth();
    const [filter, setFilter] = useState("");
    const [page, setPage] = useState(1);
    const [data, setData] = useState({ transactions: [], pagination: { page: 1, pages: 0, total: 0 } });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        let active = true;
        const loadTransactions = async () => {
            try {
                const response = await api.get("/credit-transactions", {
                    params: { page, limit: 20, ...(filter ? { type: filter } : {}) }
                });
                if (active) setData(response.data);
            } catch (requestError) {
                if (active) setError(requestError.response?.data?.message || "Could not load credit activity. Please try again.");
            } finally {
                if (active) setLoading(false);
            }
        };
        loadTransactions();
        return () => { active = false; };
    }, [filter, page, retryCount]);

    return (
        <main className="credits-billing-page">
            <header className="credits-billing-header">
                <div>
                    <p><Link to="/dashboard">← Back to Dashboard</Link></p>
                    <p className="credits-billing-eyebrow">Account activity</p>
                    <h1>Credits &amp; Billing</h1>
                    <p>Track how credits are used and added.</p>
                </div>
                <div className="credits-billing-header-actions"><div className="credits-billing-balance"><span>Available balance</span><strong>{user?.credits ?? 0}<small> credits</small></strong></div><Link className="credits-billing-buy" to="/buy-credits" state={{ from: "/credits" }}>Buy credits <span aria-hidden="true">→</span></Link></div>
            </header>
            <section className="credits-billing-history" aria-label="Credit transaction history">
                <label className="credits-billing-filter">
                    Activity
                    <select value={filter} onChange={(event) => {
                        setLoading(true);
                        setError("");
                        setFilter(event.target.value);
                        setPage(1);
                    }}>
                        {FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                </label>
                {loading && <div className="credits-billing-loading" role="status" aria-busy="true"><span className="credits-billing-spinner" aria-hidden="true" />Loading credit activity…</div>}
                {error && <div className="credits-billing-error-state" role="alert"><p>{error}</p><button type="button" onClick={() => { setLoading(true); setError(""); setRetryCount((count) => count + 1); }}>Try again</button></div>}
                {!loading && !error && data.transactions.length === 0 && (
                    <div className="credits-billing-empty">
                        <p>{filter ? "No credit activity found for this filter." : "No credit transactions yet."}</p>
                        <Link to="/buy-credits" state={{ from: "/credits" }}>Buy Credits</Link>
                    </div>
                )}
                {!loading && !error && data.transactions.length > 0 && (
                    <>
                        <div className="credits-billing-table-wrap">
                            <table className="credits-billing-table">
                                <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Credits</th><th>Balance after</th><th>Status</th></tr></thead>
                                <tbody>
                                    {data.transactions.map((transaction) => (
                                        <tr key={transaction.id}>
                                            <td data-label="Date">{formatDate(transaction.createdAt)}</td>
                                            <td data-label="Type">{transaction.type === "PURCHASE" ? "Credit purchase" : transaction.type === "GITHUB_IMPORT" ? "GitHub import" : transaction.type === "DOWNLOAD" ? "Portfolio download" : "Refund"}</td>
                                            <td data-label="Description">
                                                <strong>{transaction.reason}</strong>
                                                {transaction.portfolio?.name && <span className="credits-billing-detail">{transaction.portfolio.name}</span>}
                                                {transaction.template?.name && <span className="credits-billing-detail">{transaction.template.name} template</span>}
                                            </td>
                                            <td data-label="Credits" className={transaction.direction === "CREDIT" ? "credits-positive" : "credits-negative"}>
                                                {transaction.direction === "CREDIT" ? "+" : "−"}{transaction.amount}
                                            </td>
                                            <td data-label="Balance after">{transaction.balanceAfter}</td>
                                            <td data-label="Status"><span className={`credits-status credits-status-${String(transaction.status).toLowerCase()}`}>{String(transaction.status).toLowerCase()}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <nav className="credits-billing-pagination" aria-label="Transaction pages">
                            <span>{data.pagination.total} entries</span>
                            <div>
                                <button type="button" onClick={() => { setLoading(true); setError(""); setPage((current) => Math.max(1, current - 1)); }} disabled={page <= 1 || loading}>Previous</button>
                                <span>Page {page} of {Math.max(1, data.pagination.pages)}</span>
                                <button type="button" onClick={() => { setLoading(true); setError(""); setPage((current) => current + 1); }} disabled={loading || page >= data.pagination.pages}>Next</button>
                            </div>
                        </nav>
                    </>
                )}
            </section>
        </main>
    );
}

export default CreditsBilling;
