import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import api from "../services/api";
import "./AdminVerification.css";

function AdminVerification() {
    const { user, isAuthenticated, isAuthLoading, setAdminVerification } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [verified, setVerified] = useState(false);
    const [error, setError] = useState("");

    const requestedPath = location.state?.from;
    const destination = typeof requestedPath === "string" &&
        (requestedPath === "/admin" || requestedPath.startsWith("/admin/")) &&
        requestedPath !== "/admin/verify"
        ? requestedPath
        : "/admin";

    useEffect(() => {
        if (!verified) return undefined;
        const timer = window.setTimeout(() => navigate(destination, { replace: true }), 900);
        return () => window.clearTimeout(timer);
    }, [verified, destination, navigate]);

    if (isAuthLoading) return null;
    if (!isAuthenticated) return <Navigate to="/login" state={{ from: "/admin/verify" }} replace />;
    if (user?.role !== "admin") return <Navigate to="/dashboard" replace />;

    const submit = async (event) => {
        event.preventDefault();
        if (loading || verified) return;
        setLoading(true);
        setError("");
        try {
            const response = await api.post("/admin/verify", { password });
            setAdminVerification(response.data.verificationToken);
            setVerified(true);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to verify admin access right now.");
        } finally {
            setLoading(false);
            setPassword("");
        }
    };

    return <main className="admin-verification-page">
        <section className="admin-verification-card" aria-labelledby="admin-verification-title">
            {verified ? <div className="admin-verification-success" role="status" aria-live="polite">
                <div className="admin-success-mark" aria-hidden="true"><span>✓</span></div>
                <h1>Access verified</h1>
                <p>Opening your admin workspace…</p>
            </div> : <>
                <div className="admin-verification-emblem" aria-hidden="true">A</div>
                <p className="admin-verification-eyebrow">PORTFOLIO GENERATOR</p>
                <h1 id="admin-verification-title">Admin verification</h1>
                <p className="admin-verification-description">Enter the admin access password to continue to the protected workspace.</p>
                {error && <p className="admin-verification-error" role="alert">{error}</p>}
                <form onSubmit={submit} className="admin-verification-form">
                    <label htmlFor="admin-access-password">Admin access password</label>
                    <div className="admin-password-wrap">
                        <input
                            id="admin-access-password"
                            type={visible ? "text" : "password"}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            autoComplete="current-password"
                            disabled={loading}
                            required
                        />
                        <button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Hide password" : "Show password"}>
                            {visible ? "Hide" : "Show"}
                        </button>
                    </div>
                    <button className="admin-verification-submit" type="submit" disabled={loading || !password}>
                        {loading ? "Verifying…" : "Verify and continue"}
                    </button>
                </form>
                <p className="admin-verification-footer"><Link to="/dashboard">Return to dashboard</Link></p>
            </>}
        </section>
    </main>;
}

export default AdminVerification;
