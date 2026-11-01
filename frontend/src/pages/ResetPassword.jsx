import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import PasswordInput from "../components/PasswordInput";
import PasswordRequirements from "../components/PasswordRequirements";
import { isValidPassword } from "../utils/passwordValidation";
import "./Auth.css";

export default function ResetPassword() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const matches = password === confirmPassword;
    const submit = async (event) => {
        event.preventDefault(); setError("");
        if (!isValidPassword(password)) { setError("Meet all password requirements before continuing."); return; }
        if (!matches) { setError("Passwords do not match."); return; }
        setLoading(true);
        try {
            await api.post(`/auth/reset-password/${encodeURIComponent(token || "")}`, { password });
            navigate("/login", { state: { message: "Password reset successfully. You can now log in." } });
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to reset your password.");
        } finally { setLoading(false); }
    };
    return <main className="auth-page auth-page-centered">
        <section className="auth-card" aria-labelledby="reset-title">
            <Link className="auth-brand" to="/" aria-label="Portfolio Generator home"><span className="auth-brand-mark" aria-hidden="true">P</span><span>Portfolio <span>Generator</span></span></Link>
            <div className="auth-heading">
                <p className="auth-eyebrow">Choose a new password</p>
                <h1 id="reset-title">Secure your account</h1>
                <p>Use a strong password that meets each requirement below.</p>
            </div>
            {error && <p className="auth-notice auth-error" role="alert">{error}</p>}
            <form className="auth-form" onSubmit={submit} aria-busy={loading}>
                <PasswordInput id="reset-password" label="New password" value={password} onChange={(event) => setPassword(event.target.value)} />
                <PasswordRequirements password={password} />
                <PasswordInput id="reset-confirm-password" label="Confirm new password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                {confirmPassword && !matches && <p className="password-match" role="alert">Passwords do not match.</p>}
                {confirmPassword && matches && <p className="password-confirmed" role="status">Passwords match.</p>}
                <button className="auth-submit" type="submit" disabled={loading || !isValidPassword(password) || !matches}>
                    {loading && <span className="auth-spinner" aria-hidden="true" />}
                    {loading ? "Updating password…" : "Reset password"}
                    {!loading && <span aria-hidden="true">→</span>}
                </button>
            </form>
            <p className="auth-bottom-link"><Link to="/login">← Back to sign in</Link></p>
        </section>
    </main>;
}
