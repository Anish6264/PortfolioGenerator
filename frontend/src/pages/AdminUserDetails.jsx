import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../services/api";
import "./AdminUserDetails.css";

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

function AdminUserDetails() {
    const { id } = useParams();
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        const loadDetails = async () => {
            try {
                const response = await api.get("/admin/users/" + encodeURIComponent(id));
                if (active) setDetails(response.data);
            } catch (requestError) {
                if (active) {
                    const status = requestError.response?.status;
                    setError(status === 400
                        ? "The user ID is invalid."
                        : status === 404
                            ? "This user was not found."
                            : status === 401
                                ? "Your session is no longer valid. Please sign in again."
                                : status === 403
                                    ? "Admin access is required to view user details."
                                    : "User details could not be loaded. Please try again.");
                }
            } finally {
                if (active) setLoading(false);
            }
        };
        loadDetails();
        return () => { active = false; };
    }, [id]);

    return (
        <main className="admin-user-details">
            <header className="admin-user-details-header">
                <div>
                    <p><Link to="/admin/users">← Back to Users</Link></p>
                    <h1>User Details</h1>
                </div>
                <nav aria-label="Admin navigation">
                    <Link to="/admin">Dashboard</Link>
                    <Link to="/admin/users">Users</Link>
                    <Link to="/admin/payments">Payments</Link>
                    <Link to="/admin/credit-transactions">Credit Transactions</Link>
                    <Link to="/admin/portfolios">Portfolios</Link>
                    <Link to="/admin/templates">Templates</Link>
                </nav>
            </header>

            {loading && <p role="status">Loading user details…</p>}
            {error && <p className="admin-user-details-error" role="alert">{error}</p>}
            {details && (
                <>
                    <section className="admin-user-section">
                        <h2>Profile</h2>
                        <dl className="admin-user-profile-grid">
                            <div><dt>Name</dt><dd>{details.user.name}</dd></div>
                            <div><dt>Email</dt><dd>{details.user.email}</dd></div>
                            <div><dt>Role</dt><dd>{details.user.role}</dd></div>
                            <div><dt>Credits</dt><dd>{details.user.credits}</dd></div>
                            <div><dt>Created</dt><dd>{formatDate(details.user.createdAt)}</dd></div>
                            <div><dt>Last Updated</dt><dd>{formatDate(details.user.updatedAt)}</dd></div>
                        </dl>
                    </section>

                    <section className="admin-user-section">
                        <h2>Portfolios ({details.portfolioCount}; latest {details.portfolios.length} shown, up to {details.recentLimit})</h2>
                        {details.portfolios.length === 0
                            ? <p>This user has no portfolios.</p>
                            : <div className="admin-user-table-wrap"><table>
                                <thead><tr><th>Name</th><th>Title</th><th>Template</th><th>Status</th><th>Public Slug</th><th>Created</th><th>Updated</th></tr></thead>
                                <tbody>{details.portfolios.map((portfolio) => (
                                    <tr key={portfolio.id}>
                                        <td>{portfolio.name || "—"}</td>
                                        <td>{portfolio.title || "—"}</td>
                                        <td>{portfolio.template?.name || "Unavailable"}</td>
                                        <td>{portfolio.status}</td>
                                        <td>{portfolio.slug || "—"}</td>
                                        <td>{formatDate(portfolio.createdAt)}</td>
                                        <td>{formatDate(portfolio.updatedAt)}</td>
                                    </tr>
                                ))}</tbody>
                            </table></div>}
                    </section>

                    <section className="admin-user-section">
                        <h2>Recent Credit Activity (up to {details.recentLimit})</h2>
                        {details.creditTransactions.length === 0
                            ? <p>No credit transactions recorded.</p>
                            : <div className="admin-user-table-wrap"><table>
                                <thead><tr><th>Date</th><th>Type</th><th>Direction</th><th>Credits</th><th>Balance</th><th>Reason</th><th>Status</th></tr></thead>
                                <tbody>{details.creditTransactions.map((entry) => (
                                    <tr key={entry.id}>
                                        <td>{formatDate(entry.createdAt)}</td>
                                        <td>{entry.type}</td>
                                        <td>{entry.direction === "CREDIT" ? "Credit" : "Debit"}</td>
                                        <td className={entry.direction === "CREDIT" ? "admin-credit-positive" : "admin-credit-negative"}>
                                            {entry.direction === "CREDIT" ? "+" : "−"}{entry.amount}
                                        </td>
                                        <td>{entry.balanceBefore} → {entry.balanceAfter}</td>
                                        <td>{entry.reason}</td>
                                        <td>{entry.status}</td>
                                    </tr>
                                ))}</tbody>
                            </table></div>}
                    </section>

                    <section className="admin-user-section">
                        <h2>Recent Payments (up to {details.recentLimit})</h2>
                        {details.payments.length === 0
                            ? <p>No payments recorded.</p>
                            : <div className="admin-user-table-wrap"><table>
                                <thead><tr><th>Date</th><th>Order</th><th>Payment</th><th>Pack</th><th>Credits</th><th>Amount</th><th>Status</th></tr></thead>
                                <tbody>{details.payments.map((payment) => (
                                    <tr key={payment.id}>
                                        <td>{formatDate(payment.createdAt)}</td>
                                        <td>{payment.orderId}</td>
                                        <td>{payment.paymentId || "—"}</td>
                                        <td>{payment.pack || "Unknown pack"}</td>
                                        <td>{payment.credits}</td>
                                        <td>{formatAmount(payment.amount, payment.currency)}</td>
                                        <td>{payment.status}</td>
                                    </tr>
                                ))}</tbody>
                            </table></div>}
                    </section>
                </>
            )}
        </main>
    );
}

export default AdminUserDetails;
