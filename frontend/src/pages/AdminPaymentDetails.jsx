import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../services/api";
import "./AdminPaymentDetails.css";

const formatDate = (value) => value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—";

const formatAmount = (amount, currency) => {
    try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount / 100);
    } catch {
        return amount + " " + currency + " minor units";
    }
};

function AdminPaymentDetails() {
    const { id } = useParams();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        const loadPayment = async () => {
            try {
                const response = await api.get("/admin/payments/" + encodeURIComponent(id));
                if (active) setResult(response.data);
            } catch (requestError) {
                if (active) {
                    const status = requestError.response?.status;
                    setError(status === 400
                        ? "The payment ID is invalid."
                        : status === 404
                            ? "This payment was not found."
                            : status === 401
                                ? "Your session is no longer valid. Please sign in again."
                                : status === 403
                                    ? "Admin access is required to view payment details."
                                    : "Payment details could not be loaded. Please try again.");
                }
            } finally {
                if (active) setLoading(false);
            }
        };
        loadPayment();
        return () => { active = false; };
    }, [id]);

    const payment = result?.payment;

    return (
        <main className="admin-payment-details">
            <header className="admin-payment-details-header">
                <div>
                    <p><Link to="/admin/payments">← Back to Payments</Link></p>
                    <h1>Payment Details</h1>
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

            {loading && <p role="status">Loading payment details…</p>}
            {error && <p className="admin-payment-details-error" role="alert">{error}</p>}
            {payment && (
                <>
                    <section className="admin-payment-section">
                        <h2>Payment</h2>
                        <dl className="admin-payment-grid">
                            <div><dt>Status</dt><dd>{payment.status}</dd></div>
                            <div><dt>Credits purchased</dt><dd>{payment.credits}</dd></div>
                            <div><dt>Amount</dt><dd>{formatAmount(payment.amount, payment.currency)}</dd></div>
                            <div><dt>Currency</dt><dd>{payment.currency}</dd></div>
                        </dl>
                    </section>

                    <section className="admin-payment-section">
                        <h2>User</h2>
                        {payment.user
                            ? <dl className="admin-payment-grid">
                                <div><dt>Name</dt><dd>{payment.user.name}</dd></div>
                                <div><dt>Email</dt><dd>{payment.user.email}</dd></div>
                                <div><dt>User ID</dt><dd>{payment.user.id}</dd></div>
                            </dl>
                            : <p>The associated user account is unavailable.</p>}
                    </section>

                    <section className="admin-payment-section">
                        <h2>References</h2>
                        <dl className="admin-payment-grid">
                            <div><dt>Order ID</dt><dd>{payment.orderId}</dd></div>
                            <div><dt>Payment ID</dt><dd>{payment.paymentId || "—"}</dd></div>
                            <div><dt>Payment record ID</dt><dd>{payment.id}</dd></div>
                        </dl>
                    </section>

                    <section className="admin-payment-section">
                        <h2>Verification</h2>
                        <dl className="admin-payment-grid">
                            <div><dt>Verified at</dt><dd>{formatDate(payment.verification?.verifiedAt)}</dd></div>
                            <div><dt>Gateway payment status</dt><dd>{payment.verification?.paymentStatus || "—"}</dd></div>
                        </dl>
                    </section>

                    <section className="admin-payment-section">
                        <h2>Credit Fulfillment</h2>
                        {result.creditFulfillment
                            ? <dl className="admin-payment-grid">
                                <div><dt>Credits recorded</dt><dd>{result.creditFulfillment.credits}</dd></div>
                                <div><dt>Balance change</dt><dd>{result.creditFulfillment.balanceBefore} → {result.creditFulfillment.balanceAfter}</dd></div>
                                <div><dt>Ledger entry date</dt><dd>{formatDate(result.creditFulfillment.createdAt)}</dd></div>
                            </dl>
                            : <p>No completed PURCHASE ledger entry is linked to this payment.</p>}
                    </section>

                    <section className="admin-payment-section">
                        <h2>Dates</h2>
                        <dl className="admin-payment-grid">
                            <div><dt>Created</dt><dd>{formatDate(payment.createdAt)}</dd></div>
                            <div><dt>Updated</dt><dd>{formatDate(payment.updatedAt)}</dd></div>
                        </dl>
                    </section>
                </>
            )}
        </main>
    );
}

export default AdminPaymentDetails;
