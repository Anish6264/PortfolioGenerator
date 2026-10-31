import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

const getExpiry = (token) => {
    try {
        const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        return JSON.parse(window.atob(payload)).exp * 1000;
    } catch {
        return 0;
    }
};

function AdminRoute({ children }) {
    const { user, isAuthenticated, isAuthLoading, adminVerification } = useAuth();
    const location = useLocation();
    const [expiredToken, setExpiredToken] = useState(null);
    const expiresAt = getExpiry(adminVerification || "");

    useEffect(() => {
        if (!adminVerification) return undefined;
        const timer = window.setTimeout(
            () => setExpiredToken(adminVerification),
            Math.max(0, expiresAt - Date.now() + 10)
        );
        return () => window.clearTimeout(timer);
    }, [adminVerification, expiresAt]);

    if (isAuthLoading) return null;

    if (!isAuthenticated) {
        return (
            <Navigate
                to="/login"
                state={{ from: `${location.pathname}${location.search}${location.hash}` }}
                replace
            />
        );
    }

    if (user?.role !== "admin") {
        return <Navigate to="/dashboard" replace />;
    }

    if (!adminVerification || !expiresAt || expiredToken === adminVerification) {
        return <Navigate
            to="/admin/verify"
            state={{ from: `${location.pathname}${location.search}${location.hash}` }}
            replace
        />;
    }

    return children;
}

export default AdminRoute;
