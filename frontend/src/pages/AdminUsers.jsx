import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../services/api";
import "./AdminUsers.css";

const formatDate = (value) => new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
}).format(new Date(value));

function AdminUsers() {
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [role, setRole] = useState("all");
    const [page, setPage] = useState(1);
    const [result, setResult] = useState({ users: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        const loadUsers = async () => {
            try {
                const response = await api.get("/admin/users", {
                    params: {
                        page,
                        limit: 20,
                        ...(search ? { search } : {}),
                        ...(role !== "all" ? { role } : {})
                    }
                });
                if (active) setResult(response.data);
            } catch (requestError) {
                if (active) {
                    const status = requestError.response?.status;
                    setError(status === 401
                        ? "Your session is no longer valid. Please sign in again."
                        : status === 403
                            ? "Admin access is required to view users."
                            : "Users could not be loaded. Please try again.");
                }
            } finally {
                if (active) setLoading(false);
            }
        };
        loadUsers();
        return () => { active = false; };
    }, [page, role, search]);

    const handleSearch = (event) => {
        event.preventDefault();
        const nextSearch = searchInput.trim();
        if (nextSearch === search && page === 1) return;
        setLoading(true);
        setError("");
        setPage(1);
        setSearch(nextSearch);
    };

    const changeRole = (value) => {
        setLoading(true);
        setError("");
        setPage(1);
        setRole(value);
    };

    const changePage = (nextPage) => {
        setLoading(true);
        setError("");
        setPage(nextPage);
    };

    return (
        <main className="admin-users-page">
            <header className="admin-users-header">
                <div>
                    <p><Link to="/admin">← Admin Dashboard</Link></p>
                    <h1>Admin Users</h1>
                </div>
                <nav aria-label="Admin navigation">
                    <Link to="/admin">Dashboard</Link>
                    <Link to="/admin/users" aria-current="page">Users</Link>
                    <Link to="/admin/payments">Payments</Link>
                    <Link to="/admin/credit-transactions">Credit Transactions</Link>
                    <Link to="/admin/portfolios">Portfolios</Link>
                    <Link to="/admin/templates">Templates</Link>
                </nav>
            </header>

            <section className="admin-users-filters" aria-label="Filter users">
                <form onSubmit={handleSearch}>
                    <label>
                        Search users
                        <input
                            type="search"
                            value={searchInput}
                            onChange={(event) => setSearchInput(event.target.value)}
                            maxLength={100}
                            placeholder="Name or email"
                        />
                    </label>
                    <button type="submit" disabled={loading}>Search</button>
                </form>
                <label>
                    Role
                    <select value={role} onChange={(event) => changeRole(event.target.value)}>
                        <option value="all">All</option>
                        <option value="admin">Admin</option>
                        <option value="user">User</option>
                    </select>
                </label>
            </section>

            {loading && <p role="status">Loading users…</p>}
            {error && <p className="admin-users-error" role="alert">{error}</p>}
            {!loading && !error && result.users.length === 0 && <p>No users match these filters.</p>}
            {!loading && !error && result.users.length > 0 && (
                <>
                    <div className="admin-users-table-wrap">
                        <table className="admin-users-table">
                            <thead>
                                <tr><th>Name</th><th>Email</th><th>Role</th><th>Credits</th><th>Portfolios</th><th>Created</th><th>Action</th></tr>
                            </thead>
                            <tbody>
                                {result.users.map((user) => (
                                    <tr key={user._id}>
                                        <td>{user.name}</td>
                                        <td>{user.email}</td>
                                        <td>{user.role}</td>
                                        <td>{user.credits}</td>
                                        <td>{user.portfolioCount}</td>
                                        <td>{formatDate(user.createdAt)}</td>
                                        <td><Link to={"/admin/users/" + user._id}>View</Link></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <nav className="admin-users-pagination" aria-label="User pages">
                        <span>{result.pagination.total} users</span>
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

export default AdminUsers;
