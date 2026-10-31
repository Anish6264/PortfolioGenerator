import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
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
        <main className="auth-page">

            <h1>Login</h1>

            {notice && <p className="auth-success" role="status">{notice}</p>}

            {error && (
                <p className="auth-error" role="alert">{error}</p>
            )}

            <form className="auth-form" onSubmit={handleSubmit}>

                <div className="auth-field">
                    <label htmlFor="login-email">Email</label>

                    <input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(event) =>
                            setEmail(event.target.value)
                        }
                        required
                    />
                </div>

                <div className="auth-field">
                    <label htmlFor="login-password">Password</label>

                    <input
                        id="login-password"
                        type="password"
                        value={password}
                        onChange={(event) =>
                            setPassword(event.target.value)
                        }
                        required
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                >
                    {loading ? "Logging in..." : "Login"}
                </button>

            </form>

            <p className="auth-links">
                <Link to="/forgot-password">Forgot password?</Link>
                <br />
                Don't have an account?
                {" "}
                <Link to="/signup">
                    Create one
                </Link>
            </p>

        </main>
    );
}

export default Login;
