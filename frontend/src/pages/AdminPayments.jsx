import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../services/api";
import "./AdminPayments.css";

const formatDate = (value) => new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
}).format(new Date(value));

const formatAmount = (amount, currency) => {
    try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount / 100);
    } catch {
        return amount + " " + currency + " minor units";
    }
};

function AdminPayments() {
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("all");
    const [page, setPage] = useState(1);
    const [result, setResult] = useState({
        payments: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        filters: { statuses: [], currencies: [] }
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        const loadPayments = async () => {
            try {
                const response = await api.get("/admin/payments", {
                    params: {
                        page,
                        limit: 20,
                        ...(search ? { search } : {}),
                        ...(status !== "all" ? { status } : {})
                    }
                });
                if (active) setResult(response.data);
            } catch (requestError) {
                if (active) {
                    const code = requestError.response?.status;
                    setError(code === 401
                        ? "Your session is no longer valid. Please sign in again."
                        : code === 403
                            ? "Admin access is required to view payments."
                            : "Payments could not be loaded. Please try again.");
                }
            } finally {
                if (active) setLoading(false);
            }
        };
        loadPayments();
        return () => { active = false; };
    }, [page, search, status]);

    const submitSearch = (event) => {
        event.preventDefault();
        const nextSearch = searchInput.trim();
        if (nextSearch === search && page === 1) return;
        setLoading(true);
        setError("");
        setPage(1);
        setSearch(nextSearch);
    };

    const changeStatus = (value) => {
        setLoading(true);
        setError("");
        setPage(1);
        setStatus(value);
    };

    const changePage = (nextPage) => {
        setLoading(true);
        setError("");
        setPage(nextPage);
    };

    return (
        <main className="admin-payments-page">
            <header className="admin-payments-header">
                <div>
                    <p><Link to="/admin">← Admin Dashboard</Link></p>
                    <h1>Admin Payments</h1>
                </div>
                <nav aria-label="Admin navigation">
                    <Link to="/admin">Dashboard</Link>
                    <Link to="/admin/users">Users</Link>
                    <Link to="/admin/payments" aria-current="page">Payments</Link>
                    <Link to="/admin/credit-transactions">Credit Transactions</Link>
                    <Link to="/admin/portfolios">Portfolios</Link>
                    <Link to="/admin/templates">Templates</Link>
                </nav>
            </header>

            <section className="admin-payments-filters" aria-label="Filter payments">
                <form onSubmit={submitSearch}>
                    <label>
                        Search payments
                        <input
                            type="search"
                            value={searchInput}
                            onChange={(event) => setSearchInput(event.target.value)}
                            maxLength={100}
                            placeholder="User, order ID, or payment ID"
                        />
                    </label>
                    <button type="submit" disabled={loading}>Search</button>
                </form>
                <label>
                    Status
                    <select value={status} onChange={(event) => changeStatus(event.target.value)}>
                        <option value="all">All</option>
                        {result.filters.statuses.map((item) => (
                            <option key={item} value={item}>{item}</option>
                        ))}
                    </select>
                </label>
            </section>

            {loading && <p role="status">Loading payments…</p>}
            {error && <p className="admin-payments-error" role="alert">{error}</p>}
            {!loading && !error && result.payments.length === 0 && <p>No payments match these filters.</p>}
            {!loading && !error && result.payments.length > 0 && (
                <>
                    <div className="admin-payments-table-wrap">
                        <table className="admin-payments-table">
                            <thead><tr><th>User</th><th>Credits purchased</th><th>Amount</th><th>Currency</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
                            <tbody>
                                {result.payments.map((payment) => (
                                    <tr key={payment.id}>
                                        <td>{payment.user?.name || "Unknown user"}<span>{payment.user?.email || "User unavailable"}</span></td>
                                        <td>{payment.credits}</td>
                                        <td>{formatAmount(payment.amount, payment.currency)}</td>
                                        <td>{payment.currency}</td>
                                        <td>{payment.status}</td>
                                        <td>{formatDate(payment.createdAt)}</td>
                                        <td><Link to={"/admin/payments/" + payment.id}>View</Link></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <nav className="admin-payments-pagination" aria-label="Payment pages">
                        <span>{result.pagination.total} payment records</span>
                        <div>
                            <button type="button" onClick={() => changePage(Math.max(1, page - 1))} disabled={page <= 1 || loading}>Previous</button>
                            <span>Page {page} of {Math.max(1, result.pagination.totalPages)}</span>
                            <button type="button" onClick={() => changePage(page + 1)} disabled={loading || page >= result.pagination.totalPages}>Next</button>
                        </div>
                    </nav>
                </>
            )}
        </main>
    );
}

export default AdminPayments;
