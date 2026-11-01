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
    const currentStep = registrationToken ? 3 : otpSent ? 2 : 1;

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

    return <main className="auth-page auth-page-centered signup-page">
        <section className="auth-card auth-card-wide" aria-labelledby="signup-title">
            <Link className="auth-brand" to="/" aria-label="Portfolio Generator home">
                <span className="auth-brand-mark" aria-hidden="true">P</span>
                <span>Portfolio <span>Generator</span></span>
            </Link>
            <div className="auth-heading">
                <p className="auth-eyebrow">Your next chapter starts here</p>
                <h1 id="signup-title">Create your account</h1>
                <p>Verify your email, then set up your Portfolio Generator account.</p>
            </div>

            <ol className="signup-steps" aria-label="Sign up progress">
                {[[1, "Email"], [2, "Verify"], [3, "Account"]].map(([step, label]) => (
                    <li className={currentStep === step ? "is-current" : currentStep > step ? "is-complete" : ""} key={step} aria-current={currentStep === step ? "step" : undefined}>
                        <span className="signup-step-number" aria-hidden="true">{currentStep > step ? "✓" : step}</span>
                        <span>{label}</span>
                    </li>
                ))}
            </ol>

            {error && <p className="auth-notice auth-error" role="alert">{error}</p>}
            {message && <p className="auth-notice auth-success" role="status" aria-live="polite">{message}</p>}

            <form className="auth-form" onSubmit={handleSubmit} aria-busy={loading}>
                <div className="auth-field">
                    <label htmlFor="signup-email">Email address</label>
                    <div className="otp-row">
                        <input id="signup-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setOtpSent(false); setRegistrationToken(""); setOtp(""); setMessage(""); }} autoComplete="email" aria-describedby="signup-email-hint" required />
                        <button className="auth-secondary-button" type="button" disabled={!emailValue || loading || cooldown > 0 || Boolean(registrationToken)} onClick={requestOtp}>
                            {loading && !registrationToken ? <span className="auth-spinner" aria-hidden="true" /> : null}
                            {loading ? "Please wait…" : cooldown ? `Resend in ${cooldown}s` : otpSent ? "Resend code" : "Send code"}
                        </button>
                    </div>
                    <p className="auth-field-hint" id="signup-email-hint">We’ll send a one-time verification code to this address.</p>
                </div>

                {otpSent && !registrationToken && (
                    <div className="signup-step-panel" key="verify-step">
                        <div className="auth-field">
                            <label htmlFor="signup-otp">Six-digit verification code</label>
                            <input className="otp-code-input" id="signup-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} aria-describedby="signup-otp-hint" required />
                            <p className="auth-field-hint" id="signup-otp-hint">Enter the code from your email. It expires after five minutes.</p>
                        </div>
                        <button className="auth-submit" type="button" disabled={otp.length !== 6 || loading} onClick={verifyOtp}>
                            {loading && <span className="auth-spinner" aria-hidden="true" />}
                            {loading ? "Verifying…" : "Verify email"}
                            {!loading && <span aria-hidden="true">→</span>}
                        </button>
                    </div>
                )}

                {registrationToken && (
                    <div className="signup-step-panel" key="account-step">
                        <div className="signup-verified-note" role="status"><span aria-hidden="true">✓</span><span>Email verified. Finish setting up your account.</span></div>
                        <div className="auth-field"><label htmlFor="signup-name">Name</label><input id="signup-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></div>
                        <PasswordInput id="signup-password" label="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
                        <PasswordRequirements password={password} />
                        <PasswordInput id="signup-confirm-password" label="Confirm password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                        {confirmPassword && !passwordsMatch && <p className="password-match" role="alert">Passwords do not match.</p>}
                        {confirmPassword && passwordsMatch && <p className="password-confirmed" role="status">Passwords match.</p>}
                        <button className="auth-submit" type="submit" disabled={loading || !registrationToken || !isValidPassword(password) || !passwordsMatch}>
                            {loading && <span className="auth-spinner" aria-hidden="true" />}
                            {loading ? "Creating account…" : "Create account"}
                            {!loading && <span aria-hidden="true">→</span>}
                        </button>
                    </div>
                )}
            </form>
            <p className="auth-bottom-link">Already have an account? <Link to="/login">Sign in</Link></p>
        </section>
    </main>;
}

export default Signup;
