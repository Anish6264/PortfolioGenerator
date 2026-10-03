import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../services/api";
import "./AdminDashboard.css";

const formatDate = (value) => new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
}).format(new Date(value));

const formatRevenue = (entry) => {
    try {
        return new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: entry.currency
        }).format(entry.amountMinor / 100);
    } catch {
        return entry.amountMinor + " " + entry.currency + " minor units";
    }
};

function MetricCard({ title, values, action }) {
    return (
        <section className="admin-metric-card">
            <h3>{title}</h3>
            <dl>
                {values.map(([label, value]) => (
                    <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                    </div>
                ))}
            </dl>
            {action}
        </section>
    );
}

function RecentSection({ title, headers, rows, emptyText }) {
    return (
        <section className="admin-recent-section">
            <h2>{title}</h2>
            {rows.length === 0
                ? <p>{emptyText}</p>
                : (
                    <div className="admin-table-wrap">
                        <table>
                            <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
                            <tbody>{rows.map((row) => <tr key={row.id}>{row.cells.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody>
                        </table>
                    </div>
                )}
        </section>
    );
}

function AdminDashboard() {
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [errorStatus, setErrorStatus] = useState(null);

    const requestDashboard = useCallback(async () => {
        try {
            const response = await api.get("/admin/dashboard");
            return { data: response.data };
        } catch (requestError) {
            const status = requestError.response?.status || null;
            if (requestError.response?.status === 401) {
                return { status, error: "Your session is no longer valid. Please sign in again." };
            }
            if (status === 403) {
                return { status, error: "Admin access is required to view this dashboard." };
            }
            return { status, error: "The dashboard could not be loaded. Please try again." };
        }
    }, []);

    useEffect(() => {
        let active = true;
        requestDashboard().then((result) => {
            if (!active) return;
            if (result.data) {
                setDashboard(result.data);
                setError("");
                setErrorStatus(null);
            } else {
                setDashboard(null);
                setError(result.error);
                setErrorStatus(result.status);
            }
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => { active = false; };
    }, [requestDashboard]);

    const refreshDashboard = async () => {
        setRefreshing(true);
        setError("");
        setErrorStatus(null);
        const result = await requestDashboard();
        if (result.data) {
            setDashboard(result.data);
        } else {
            setDashboard(null);
            setError(result.error);
            setErrorStatus(result.status);
        }
        setRefreshing(false);
    };

    const stats = dashboard?.stats;
    const recent = dashboard?.recent;
    const authError = errorStatus === 401 || errorStatus === 403;

    return (
        <main className="admin-dashboard">
            <header className="admin-dashboard-header">
                <div>
                    <p>Administration</p>
                    <h1>Admin Dashboard</h1>
                    <p>Current application overview</p>
                </div>
                <nav aria-label="Admin navigation">
                    <Link to="/admin">Dashboard</Link>
                    <Link to="/admin/users">Users</Link>
                    <Link to="/admin/payments">Payments</Link>
                    <Link to="/admin/credit-transactions">Credit Transactions</Link>
                    <Link to="/admin/portfolios">Portfolios</Link>
                    <Link to="/admin/templates">Manage Templates</Link>
                </nav>
            </header>

            {loading && <p role="status">Loading dashboard…</p>}
            {error && (
                <section className="admin-dashboard-error" role="alert">
                    <p>{error}</p>
                    {errorStatus === 401 && <Link to="/login">Go to Login</Link>}
                    {errorStatus === 403 && <Link to="/dashboard">Return to Dashboard</Link>}
                    {!authError && <button type="button" onClick={refreshDashboard}>Try Again</button>}
                </section>
            )}

            {stats && (
                <>
                    <div className="admin-dashboard-section-heading">
                        <h2>Application Overview</h2>
                        <button type="button" onClick={refreshDashboard} disabled={refreshing}>
                            {refreshing ? "Refreshing…" : "Refresh"}
                        </button>
                    </div>

                    <div className="admin-metric-grid">
                        <MetricCard title="Users" values={[
                            ["Total users", stats.users.total],
                            ["Admins", stats.users.admins],
                            ["Regular users", stats.users.regular]
                        ]} action={<p><Link to="/admin/users">View users</Link></p>} />
                        <MetricCard title="Portfolios" values={[
                            ["Total", stats.portfolios.total],
                            ["Draft", stats.portfolios.draft],
                            ["Published", stats.portfolios.published]
                        ]} action={<p><Link to="/admin/portfolios">View portfolios</Link></p>} />
                        <MetricCard title="Templates" values={[
                            ["Total", stats.templates.total],
                            ["Active", stats.templates.active],
                            ["Inactive", stats.templates.inactive],
                            ["Premium", stats.templates.premium],
                            ["Standard", stats.templates.standard]
                        ]} />
                        <MetricCard title="Payments" values={[
                            ["Successful", stats.payments.paid],
                            ["Pending", stats.payments.pending],
                            ["Failed", stats.payments.failed],
                            ["Refunded", stats.payments.refunded],
                            ["Total payment records", stats.payments.total],
                            ...stats.payments.successfulRevenue.map((entry) => [
                                "Successful revenue (" + entry.currency + ")",
                                formatRevenue(entry)
                            ])
                        ]} action={<p><Link to="/admin/payments">View payments</Link></p>} />
                        <MetricCard title="Credits" values={[
                            ["Credits purchased", stats.credits.totalCreditsPurchased],
                            ["Purchase transactions", stats.credits.purchaseTransactionCount],
                            ["Credits spent", stats.credits.totalCreditsSpent],
                            ["Portfolio downloads", stats.credits.downloadTransactionCount],
                            ["GitHub imports", stats.credits.githubImportTransactionCount],
                            ["Credits refunded", stats.credits.totalCreditsRefunded],
                            ["Refund transactions", stats.credits.refundTransactionCount]
                        ]} action={<p><Link to="/admin/credit-transactions">View credit transactions</Link></p>} />
                    </div>

                    <div className="admin-recent-grid">
                        <RecentSection
                            title="Recent Users"
                            headers={["Name", "Email", "Created"]}
                            rows={recent.users.map((entry) => ({ id: entry.id, cells: [entry.name, entry.email, formatDate(entry.createdAt)] }))}
                            emptyText="No users to show."
                        />
                        <RecentSection
                            title="Recent Payments"
                            headers={["User", "Order", "Amount", "Status", "Created"]}
                            rows={recent.payments.map((entry) => ({
                                id: entry.id,
                                cells: [
                                    entry.user?.email || "Unknown user",
                                    entry.orderId,
                                    formatRevenue({ currency: entry.currency, amountMinor: entry.amount }),
                                    entry.status,
                                    formatDate(entry.createdAt)
                                ]
                            }))}
                            emptyText="No payments to show."
                        />
                        <RecentSection
                            title="Recent Credit Transactions"
                            headers={["User", "Type", "Credits", "Description", "Created"]}
                            rows={recent.creditTransactions.map((entry) => ({
                                id: entry.id,
                                cells: [
                                    entry.user?.email || "Unknown user",
                                    entry.type,
                                    (entry.direction === "CREDIT" ? "+" : "−") + entry.amount,
                                    entry.reason,
                                    formatDate(entry.createdAt)
                                ]
                            }))}
                            emptyText="No credit transactions to show."
                        />
                        <RecentSection
                            title="Recent Portfolios"
                            headers={["Portfolio", "User", "Status", "Created"]}
                            rows={recent.portfolios.map((entry) => ({
                                id: entry.id,
                                cells: [entry.name, entry.user?.email || "Unknown user", entry.status, formatDate(entry.createdAt)]
                            }))}
                            emptyText="No portfolios to show."
                        />
                    </div>
                    <p className="admin-dashboard-footnote">Each recent activity list shows up to {dashboard.recentLimit} records.</p>
                </>
            )}
        </main>
    );
}

export default AdminDashboard;
