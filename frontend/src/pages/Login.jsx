import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import api from "../services/api";
import { useAuth } from "../hooks/useAuth";

function Login() {

    const navigate = useNavigate();
    const location = useLocation();

    const { login } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

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
        <div>

            <h1>Login</h1>

            {error && (
                <p>{error}</p>
            )}

            <form onSubmit={handleSubmit}>

                <div>
                    <label>Email</label>

                    <input
                        type="email"
                        value={email}
                        onChange={(event) =>
                            setEmail(event.target.value)
                        }
                        required
                    />
                </div>

                <div>
                    <label>Password</label>

                    <input
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

            <p>
                Don't have an account?
                {" "}
                <Link to="/signup">
                    Create one
                </Link>
            </p>

        </div>
    );
}

export default Login;