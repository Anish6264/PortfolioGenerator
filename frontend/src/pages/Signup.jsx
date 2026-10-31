import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
import PasswordInput from "../components/PasswordInput";
import PasswordRequirements from "../components/PasswordRequirements";
import { isValidPassword } from "../utils/passwordValidation";
import "./Auth.css";

function Signup() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [otp, setOtp] = useState("");
    const [registrationToken, setRegistrationToken] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const emailValue = email.trim().toLowerCase();
    const passwordsMatch = password === confirmPassword;

    useEffect(() => {
        if (cooldown <= 0) return undefined;
        const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
        return () => window.clearTimeout(timer);
    }, [cooldown]);

    const requestOtp = async () => {
        setError(""); setMessage(""); setLoading(true);
        try {
            await api.post("/auth/signup/otp", { email: emailValue });
            setOtpSent(true); setRegistrationToken(""); setCooldown(60);
            setMessage("A verification code was sent to your email. It expires in 5 minutes.");
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to send a verification code.");
        } finally { setLoading(false); }
    };

    const verifyOtp = async () => {
        setError(""); setMessage(""); setLoading(true);
        try {
            const response = await api.post("/auth/signup/verify-otp", { email: emailValue, otp });
            setRegistrationToken(response.data.registrationToken);
            setMessage("Email verified. Complete the form to create your account.");
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to verify this code.");
        } finally { setLoading(false); }
    };

    const handleSubmit = async (event) => {
        event.preventDefault(); setError(""); setMessage("");
        if (!registrationToken) { setError("Verify your email before creating an account."); return; }
        if (!isValidPassword(password)) { setError("Meet all password requirements before continuing."); return; }
        if (!passwordsMatch) { setError("Passwords do not match."); return; }
        setLoading(true);
        try {
            await api.post("/auth/register", { name, email: emailValue, password, registrationToken });
            const loginResponse = await api.post("/auth/login", { email: emailValue, password });
            login(loginResponse.data.token, loginResponse.data.user);
            navigate("/");
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Signup failed.");
        } finally { setLoading(false); }
    };

    return <main className="auth-page">
        <h1>Create account</h1>
        <p className="auth-intro">Build and publish your portfolio with Portfolio Generator.</p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {message && <p className="auth-success" role="status">{message}</p>}
        <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field"><label htmlFor="signup-name">Name</label><input id="signup-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></div>
            <div className="auth-field"><label htmlFor="signup-email">Email</label><div className="otp-row">
                <input id="signup-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setOtpSent(false); setRegistrationToken(""); setOtp(""); setMessage(""); }} autoComplete="email" required />
                <button className="auth-button" type="button" disabled={!emailValue || loading || cooldown > 0 || Boolean(registrationToken)} onClick={requestOtp}>{loading ? "Please wait…" : cooldown ? `Resend in ${cooldown}s` : otpSent ? "Resend code" : "Send code"}</button>
            </div></div>
            {otpSent && !registrationToken && <div className="auth-field"><label htmlFor="signup-otp">Six-digit verification code</label><div className="otp-row">
                <input id="signup-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} required />
                <button className="auth-button" type="button" disabled={otp.length !== 6 || loading} onClick={verifyOtp}>{loading ? "Verifying…" : "Verify email"}</button>
            </div></div>}
            <PasswordInput id="signup-password" label="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
            <PasswordRequirements password={password} />
            <PasswordInput id="signup-confirm-password" label="Confirm password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            {confirmPassword && !passwordsMatch && <p className="password-match" role="alert">Passwords do not match.</p>}
            <button className="auth-button" type="submit" disabled={loading || !registrationToken || !isValidPassword(password) || !passwordsMatch}>{loading ? "Creating account…" : "Create account"}</button>
        </form>
        <p className="auth-links">Already have an account? <Link to="/login">Log in</Link></p>
    </main>;
}

export default Signup;
