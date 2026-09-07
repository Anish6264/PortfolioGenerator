import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../services/api";
import { useAuth } from "../hooks/useAuth";

function Signup() {

    const navigate = useNavigate();

    const { login } = useAuth();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event) => {

        event.preventDefault();

        setError("");
        setLoading(true);

        try {

            await api.post(
                "/auth/register",
                {
                    name,
                    email,
                    password
                }
            );

            const loginResponse = await api.post(
                "/auth/login",
                {
                    email,
                    password
                }
            );

            login(
                loginResponse.data.token,
                loginResponse.data.user
            );

            navigate("/");

        } catch (error) {

            setError(
                error.response?.data?.message ||
                "Signup failed"
            );

        } finally {

            setLoading(false);
        }
    };

    return (
        <div>

            <h1>Create Account</h1>

            {error && (
                <p>{error}</p>
            )}

            <form onSubmit={handleSubmit}>

                <div>
                    <label>Name</label>

                    <input
                        type="text"
                        value={name}
                        onChange={(event) =>
                            setName(event.target.value)
                        }
                        required
                    />
                </div>

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
                        minLength="6"
                        required
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                >
                    {loading
                        ? "Creating account..."
                        : "Create Account"}
                </button>

            </form>

            <p>
                Already have an account?
                {" "}
                <Link to="/login">
                    Login
                </Link>
            </p>

        </div>
    );
}

export default Signup;