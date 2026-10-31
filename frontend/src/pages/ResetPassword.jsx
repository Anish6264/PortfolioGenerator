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
    return <main className="auth-page">
        <h1>Reset password</h1>
        <p className="auth-intro">Choose a new password for your account.</p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <form className="auth-form" onSubmit={submit}>
            <PasswordInput id="reset-password" label="New password" value={password} onChange={(event) => setPassword(event.target.value)} />
            <PasswordRequirements password={password} />
            <PasswordInput id="reset-confirm-password" label="Confirm new password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            {confirmPassword && !matches && <p className="password-match" role="alert">Passwords do not match.</p>}
            <button className="auth-button" type="submit" disabled={loading || !isValidPassword(password) || !matches}>{loading ? "Updating password…" : "Reset password"}</button>
        </form>
        <p className="auth-links"><Link to="/login">Back to login</Link></p>
    </main>;
}
