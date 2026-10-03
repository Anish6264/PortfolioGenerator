import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../services/api";
import "./AdminPortfolios.css";

const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";

function AdminPortfolios() {
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("all");
    const [template, setTemplate] = useState("all");
    const [category, setCategory] = useState("all");
    const [page, setPage] = useState(1);
    const [templates, setTemplates] = useState([]);
    const [result, setResult] = useState({
        portfolios: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        filters: { statuses: [], categories: [] }
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        api.get("/admin/templates")
            .then((response) => { if (active) setTemplates(response.data.templates || []); })
            .catch(() => { if (active) setError("Template filter options could not be loaded."); });
        return () => { active = false; };
    }, []);

    useEffect(() => {
        let active = true;
        const loadPortfolios = async () => {
            try {
                const response = await api.get("/admin/portfolios", {
                    params: {
                        page, limit: 20,
                        ...(search ? { search } : {}),
                        ...(status !== "all" ? { status } : {}),
                        ...(template !== "all" ? { template } : {}),
                        ...(category !== "all" ? { category } : {})
                    }
                });
                if (active) { setResult(response.data); setError(""); }
            } catch (requestError) {
                if (active) {
                    const code = requestError.response?.status;
                    setError(code === 401
                        ? "Your session is no longer valid. Please sign in again."
                        : code === 403
                            ? "Admin access is required to view portfolios."
                            : "Portfolios could not be loaded. Please try again.");
                }
            } finally {
                if (active) setLoading(false);
            }
        };
        loadPortfolios();
        return () => { active = false; };
    }, [page, search, status, template, category]);

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
        <main className="admin-portfolios-page">
            <header className="admin-portfolios-header">
                <div><p><Link to="/admin">← Admin Dashboard</Link></p><h1>Admin Portfolios</h1></div>
                <nav aria-label="Admin navigation">
                    <Link to="/admin">Dashboard</Link><Link to="/admin/users">Users</Link>
                    <Link to="/admin/payments">Payments</Link><Link to="/admin/credit-transactions">Credit Transactions</Link>
                    <Link to="/admin/portfolios" aria-current="page">Portfolios</Link><Link to="/admin/templates">Templates</Link>
                </nav>
            </header>

            <section className="admin-portfolios-filters" aria-label="Filter portfolios">
                <form onSubmit={submitSearch}>
                    <label>Search portfolios
                        <input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} maxLength={100} placeholder="Portfolio or owner name/email" />
                    </label>
                    <button type="submit" disabled={loading}>Search</button>
                </form>
                <label>Status<select value={status} onChange={(event) => updateFilter(setStatus)(event.target.value)}>
                    <option value="all">All</option>{result.filters.statuses.map((item) => <option key={item} value={item}>{item}</option>)}
                </select></label>
                <label>Template<select value={template} onChange={(event) => updateFilter(setTemplate)(event.target.value)}>
                    <option value="all">All</option>{templates.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
                </select></label>
                <label>Category<select value={category} onChange={(event) => updateFilter(setCategory)(event.target.value)}>
                    <option value="all">All</option>{result.filters.categories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select></label>
            </section>

            {loading && <p role="status">Loading portfolios…</p>}
            {error && <p className="admin-portfolios-error" role="alert">{error}</p>}
            {!loading && !error && result.portfolios.length === 0 && <p>No portfolios match these filters.</p>}
            {!loading && !error && result.portfolios.length > 0 && <>
                <div className="admin-portfolios-table-wrap"><table>
                    <thead><tr><th>Portfolio</th><th>Owner</th><th>Template</th><th>Status</th><th>Created</th><th>Updated</th><th>Action</th></tr></thead>
                    <tbody>{result.portfolios.map((portfolio) => <tr key={portfolio.id}>
                        <td>{portfolio.name || "Untitled portfolio"}<span>{portfolio.title || "No title"}</span></td>
                        <td>{portfolio.owner?.name || "Unknown owner"}<span>{portfolio.owner?.email || "Account unavailable"}</span></td>
                        <td>{portfolio.template?.name || "Template unavailable"}<span>{portfolio.template?.category || ""}</span></td>
                        <td>{portfolio.status}</td><td>{formatDate(portfolio.createdAt)}</td><td>{formatDate(portfolio.updatedAt)}</td>
                        <td><Link to={`/admin/portfolios/${portfolio.id}`}>View</Link></td>
                    </tr>)}</tbody>
                </table></div>
                <nav className="admin-portfolios-pagination" aria-label="Portfolio pages">
                    <span>{result.pagination.total} portfolios</span><div>
                        <button type="button" onClick={() => changePage(Math.max(1, page - 1))} disabled={page <= 1 || loading}>Previous</button>
                        <span>Page {page} of {Math.max(1, result.pagination.totalPages)}</span>
                        <button type="button" onClick={() => changePage(page + 1)} disabled={loading || page >= result.pagination.totalPages}>Next</button>
                    </div>
                </nav>
            </>}
        </main>
    );
}

export default AdminPortfolios;
