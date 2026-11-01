import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
import PasswordInput from "../components/PasswordInput";
import "./Auth.css";

function Login() {

    const navigate = useNavigate();
    const location = useLocation();

    const { login } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const notice = location.state?.message || "";

    const handleSubmit = async (event) => {

        event.preventDefault();

        setError("");
        setLoading(true);

        try {

            const response = await api.post(
                "/auth/login",
                {
                    email,
                    password
                }
            );

            login(
                response.data.token,
                response.data.user
            );

            const redirectPath =
                location.state?.from ||
                "/";

            navigate(redirectPath);

        } catch (error) {

            setError(
                error.response?.data?.message ||
                "Login failed"
            );

        } finally {

            setLoading(false);
        }
    };

    return (
        <main className="auth-page auth-page-centered">
            <section className="auth-card" aria-labelledby="login-title">
                <Link className="auth-brand" to="/" aria-label="Portfolio Generator home">
                    <span className="auth-brand-mark" aria-hidden="true">P</span>
                    <span>Portfolio <span>Generator</span></span>
                </Link>
                <div className="auth-heading">
                    <p className="auth-eyebrow">Welcome back</p>
                    <h1 id="login-title">Sign in to your account</h1>
                    <p>Pick up where you left off and keep building your portfolio.</p>
                </div>

                {notice && <p className="auth-notice auth-success" role="status">{notice}</p>}
                {error && <p className="auth-notice auth-error" role="alert">{error}</p>}

                <form className="auth-form" onSubmit={handleSubmit} aria-busy={loading}>
                    <div className="auth-field">
                        <label htmlFor="login-email">Email address</label>
                        <input
                            id="login-email"
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            autoComplete="email"
                            required
                        />
                    </div>

                    <PasswordInput
                        id="login-password"
                        label="Password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                    />

                    <div className="auth-inline-link"><Link to="/forgot-password">Forgot password?</Link></div>

                    <button className="auth-submit" type="submit" disabled={loading}>
                        {loading && <span className="auth-spinner" aria-hidden="true" />}
                        {loading ? "Signing in…" : "Sign in"}
                        {!loading && <span aria-hidden="true">→</span>}
                    </button>
                </form>

                <p className="auth-bottom-link">New to Portfolio Generator? <Link to="/signup">Create an account</Link></p>
            </section>
        </main>
    );
}

export default Login;
