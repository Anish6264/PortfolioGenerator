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
    }, [filter, page]);

    return (
        <main className="credits-billing-page">
            <header className="credits-billing-header">
                <div>
                    <p><Link to="/dashboard">← Back to Dashboard</Link></p>
                    <h1>Credits &amp; Billing</h1>
                    <p>Current balance: <strong>{user?.credits ?? 0} credits</strong></p>
                </div>
                <Link className="credits-billing-buy" to="/buy-credits" state={{ from: "/credits" }}>Buy Credits</Link>
            </header>
            <section aria-label="Credit transaction history">
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
                {loading && <p role="status">Loading credit activity…</p>}
                {error && <p className="credits-billing-error" role="alert">{error}</p>}
                {!loading && !error && data.transactions.length === 0 && (
                    <div>
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
                                            <td>{formatDate(transaction.createdAt)}</td>
                                            <td>{transaction.type === "PURCHASE" ? "Credit purchase" : transaction.type === "GITHUB_IMPORT" ? "GitHub import" : transaction.type === "DOWNLOAD" ? "Portfolio download" : "Refund"}</td>
                                            <td>
                                                <strong>{transaction.reason}</strong>
                                                {transaction.portfolio?.name && <span className="credits-billing-detail">{transaction.portfolio.name}</span>}
                                                {transaction.template?.name && <span className="credits-billing-detail">{transaction.template.name} template</span>}
                                            </td>
                                            <td className={transaction.direction === "CREDIT" ? "credits-positive" : "credits-negative"}>
                                                {transaction.direction === "CREDIT" ? "+" : "−"}{transaction.amount}
                                            </td>
                                            <td>{transaction.balanceAfter}</td>
                                            <td>{transaction.status.toLowerCase()}</td>
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
