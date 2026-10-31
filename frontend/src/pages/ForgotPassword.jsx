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
    return <main className="auth-page">
        <h1>Forgot password</h1>
        <p className="auth-intro">Enter the email address for your account. If it exists, we’ll send a reset link.</p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {message && <p className="auth-success" role="status">{message}</p>}
        <form className="auth-form" onSubmit={submit}>
            <div className="auth-field"><label htmlFor="forgot-email">Email</label><input id="forgot-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
            <button className="auth-button" type="submit" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</button>
        </form>
        <p className="auth-links"><Link to="/login">Back to login</Link></p>
    </main>;
}
