import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../services/api";
import "./AdminCreditTransactionDetails.css";

const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";

function AdminCreditTransactionDetails() {
    const { id } = useParams();
    const [transaction, setTransaction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        api.get("/admin/credit-transactions/" + encodeURIComponent(id))
            .then((response) => { if (active) setTransaction(response.data.transaction); })
            .catch((requestError) => {
                if (!active) return;
                const code = requestError.response?.status;
                setError(code === 400 ? "This credit transaction ID is invalid."
                    : code === 404 ? "Credit transaction not found."
                        : code === 401 ? "Your session is no longer valid. Please sign in again."
                            : code === 403 ? "Admin access is required to view credit transactions."
                                : "Credit transaction details could not be loaded. Please try again.");
            })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [id]);

    return (
        <main className="admin-credit-detail">
            <header className="admin-credit-detail-header">
                <div><p><Link to="/admin/credit-transactions">← Back to Credit Transactions</Link></p><h1>Credit Transaction Details</h1></div>
                <nav aria-label="Admin navigation">
                    <Link to="/admin">Dashboard</Link><Link to="/admin/users">Users</Link>
                    <Link to="/admin/payments">Payments</Link><Link to="/admin/credit-transactions" aria-current="page">Credit Transactions</Link>
                    <Link to="/admin/portfolios">Portfolios</Link>
                    <Link to="/admin/templates">Templates</Link>
                </nav>
            </header>
            {loading && <p role="status">Loading transaction details…</p>}
            {error && <p className="admin-credit-detail-error" role="alert">{error}</p>}
            {transaction && <>
                <section className="admin-credit-detail-section"><h2>Transaction</h2><dl className="admin-credit-detail-grid">
                    <div><dt>Transaction ID</dt><dd>{transaction.id}</dd></div><div><dt>Type</dt><dd>{transaction.type}</dd></div>
                    <div><dt>Direction</dt><dd>{transaction.direction}</dd></div><div><dt>Amount</dt><dd>{transaction.amount} credits</dd></div>
                    <div><dt>Status</dt><dd>{transaction.status}</dd></div><div><dt>Reason</dt><dd>{transaction.reason}</dd></div>
                    <div><dt>Balance before</dt><dd>{transaction.balanceBefore}</dd></div><div><dt>Balance after</dt><dd>{transaction.balanceAfter}</dd></div>
                    <div><dt>Reference ID</dt><dd>{transaction.referenceId || "—"}</dd></div>
                    <div><dt>Created</dt><dd>{formatDate(transaction.createdAt)}</dd></div><div><dt>Updated</dt><dd>{formatDate(transaction.updatedAt)}</dd></div>
                </dl></section>
                <section className="admin-credit-detail-section"><h2>User</h2>{transaction.user ? <dl className="admin-credit-detail-grid">
                    <div><dt>Name</dt><dd>{transaction.user.name}</dd></div><div><dt>Email</dt><dd>{transaction.user.email}</dd></div><div><dt>User ID</dt><dd>{transaction.user.id}</dd></div>
                </dl> : <p>The associated user account is unavailable.</p>}</section>
                {transaction.portfolio && <section className="admin-credit-detail-section"><h2>Portfolio summary</h2><dl className="admin-credit-detail-grid">
                    <div><dt>Name</dt><dd>{transaction.portfolio.name || "—"}</dd></div><div><dt>Title</dt><dd>{transaction.portfolio.title || "—"}</dd></div>
                    <div><dt>Status</dt><dd>{transaction.portfolio.status || "—"}</dd></div><div><dt>Portfolio ID</dt><dd>{transaction.portfolio.id}</dd></div>
                </dl></section>}
                {transaction.template && <section className="admin-credit-detail-section"><h2>Template</h2><dl className="admin-credit-detail-grid">
                    <div><dt>Name</dt><dd>{transaction.template.name}</dd></div><div><dt>Category</dt><dd>{transaction.template.category}</dd></div><div><dt>Template ID</dt><dd>{transaction.template.id}</dd></div>
                </dl></section>}
                {transaction.payment && <section className="admin-credit-detail-section"><h2>Payment reference</h2><dl className="admin-credit-detail-grid">
                    <div><dt>Payment record ID</dt><dd>{transaction.payment.id}</dd></div><div><dt>Order ID</dt><dd>{transaction.payment.orderId}</dd></div>
                    <div><dt>Payment ID</dt><dd>{transaction.payment.paymentId || "—"}</dd></div><div><dt>Amount</dt><dd>{transaction.payment.amount} {transaction.payment.currency}</dd></div>
                    <div><dt>Payment status</dt><dd>{transaction.payment.status}</dd></div>
                </dl></section>}
            </>}
        </main>
    );
}

export default AdminCreditTransactionDetails;
