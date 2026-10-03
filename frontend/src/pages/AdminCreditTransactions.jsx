import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../services/api";
import "./AdminCreditTransactions.css";

const formatDate = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

function AdminCreditTransactions() {
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [type, setType] = useState("all");
    const [direction, setDirection] = useState("all");
    const [status, setStatus] = useState("all");
    const [page, setPage] = useState(1);
    const [result, setResult] = useState({
        transactions: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        filters: { types: [], directions: [], statuses: [] }
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        const loadTransactions = async () => {
            try {
                const response = await api.get("/admin/credit-transactions", {
                    params: {
                        page, limit: 20,
                        ...(search ? { search } : {}),
                        ...(type !== "all" ? { type } : {}),
                        ...(direction !== "all" ? { direction } : {}),
                        ...(status !== "all" ? { status } : {})
                    }
                });
                if (active) { setResult(response.data); setError(""); }
            } catch (requestError) {
                if (active) {
                    const code = requestError.response?.status;
                    setError(code === 401
                        ? "Your session is no longer valid. Please sign in again."
                        : code === 403
                            ? "Admin access is required to view credit transactions."
                            : "Credit transactions could not be loaded. Please try again.");
                }
            } finally {
                if (active) setLoading(false);
            }
        };
        loadTransactions();
        return () => { active = false; };
    }, [page, search, type, direction, status]);

    const updateFilter = (setter) => (value) => {
        setLoading(true);
        setError("");
        setPage(1);
        setter(value);
    };
    const submitSearch = (event) => {
        event.preventDefault();
        const nextSearch = searchInput.trim();
        if (nextSearch === search && page === 1) return;
        setLoading(true);
        setError("");
        setPage(1);
        setSearch(nextSearch);
    };
    const changePage = (nextPage) => { setLoading(true); setError(""); setPage(nextPage); };

    return (
        <main className="admin-credit-transactions">
            <header className="admin-credit-header">
                <div><p><Link to="/admin">← Admin Dashboard</Link></p><h1>Credit Transactions</h1></div>
                <nav aria-label="Admin navigation">
                    <Link to="/admin">Dashboard</Link><Link to="/admin/users">Users</Link>
                    <Link to="/admin/payments">Payments</Link><Link to="/admin/credit-transactions" aria-current="page">Credit Transactions</Link>
                    <Link to="/admin/portfolios">Portfolios</Link>
                    <Link to="/admin/templates">Templates</Link>
                </nav>
            </header>

            <section className="admin-credit-filters" aria-label="Filter credit transactions">
                <form onSubmit={submitSearch}>
                    <label>Search transactions
                        <input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} maxLength={100} placeholder="User, reason, or reference" />
                    </label>
                    <button type="submit" disabled={loading}>Search</button>
                </form>
                <label>Type<select value={type} onChange={(event) => updateFilter(setType)(event.target.value)}><option value="all">All</option>{result.filters.types.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>Direction<select value={direction} onChange={(event) => updateFilter(setDirection)(event.target.value)}><option value="all">All</option>{result.filters.directions.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>Status<select value={status} onChange={(event) => updateFilter(setStatus)(event.target.value)}><option value="all">All</option>{result.filters.statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
            </section>

            {loading && <p role="status">Loading credit transactions…</p>}
            {error && <p className="admin-credit-error" role="alert">{error}</p>}
            {!loading && !error && result.transactions.length === 0 && <p>No credit transactions match these filters.</p>}
            {!loading && !error && result.transactions.length > 0 && <>
                <div className="admin-credit-table-wrap"><table>
                    <thead><tr><th>User</th><th>Type</th><th>Direction</th><th>Credits</th><th>Balance</th><th>Reason</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
                    <tbody>{result.transactions.map((item) => <tr key={item.id}>
                        <td>{item.user?.name || "Unknown user"}<span>{item.user?.email || "User unavailable"}</span></td>
                        <td>{item.type}</td><td>{item.direction}</td>
                        <td>{item.direction === "CREDIT" ? "+" : "−"}{item.amount}</td>
                        <td>{item.balanceBefore} → {item.balanceAfter}</td><td>{item.reason}</td><td>{item.status}</td>
                        <td>{formatDate(item.createdAt)}</td><td><Link to={`/admin/credit-transactions/${item.id}`}>View</Link></td>
                    </tr>)}</tbody>
                </table></div>
                <nav className="admin-credit-pagination" aria-label="Credit transaction pages">
                    <span>{result.pagination.total} transactions</span><div>
                        <button type="button" onClick={() => changePage(Math.max(1, page - 1))} disabled={page <= 1 || loading}>Previous</button>
                        <span>Page {page} of {Math.max(1, result.pagination.totalPages)}</span>
                        <button type="button" onClick={() => changePage(page + 1)} disabled={loading || page >= result.pagination.totalPages}>Next</button>
                    </div>
                </nav>
            </>}
        </main>
    );
}

export default AdminCreditTransactions;
