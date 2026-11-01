import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import "./Auth.css";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const submit = async (event) => {
        event.preventDefault(); setLoading(true); setMessage(""); setError("");
        try {
            const response = await api.post("/auth/forgot-password", { email: email.trim().toLowerCase() });
            setMessage(response.data.message);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to request a reset link right now.");
        } finally { setLoading(false); }
    };
    return <main className="auth-page auth-page-centered">
        <section className="auth-card" aria-labelledby="forgot-title">
            <Link className="auth-brand" to="/" aria-label="Portfolio Generator home"><span className="auth-brand-mark" aria-hidden="true">P</span><span>Portfolio <span>Generator</span></span></Link>
            <div className="auth-heading">
                <p className="auth-eyebrow">Account recovery</p>
                <h1 id="forgot-title">Reset your password</h1>
                <p>Enter the email address for your account. If it exists, we’ll send a reset link with the next steps.</p>
            </div>
            {error && <p className="auth-notice auth-error" role="alert">{error}</p>}
            {message && <p className="auth-notice auth-success" role="status" aria-live="polite">{message}</p>}
            <form className="auth-form" onSubmit={submit} aria-busy={loading}>
                <div className="auth-field"><label htmlFor="forgot-email">Email address</label><input id="forgot-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
                <button className="auth-submit" type="submit" disabled={loading}>
                    {loading && <span className="auth-spinner" aria-hidden="true" />}
                    {loading ? "Sending reset link…" : "Send reset link"}
                    {!loading && <span aria-hidden="true">→</span>}
                </button>
            </form>
            <p className="auth-bottom-link"><Link to="/login">← Back to sign in</Link></p>
        </section>
    </main>;
}
