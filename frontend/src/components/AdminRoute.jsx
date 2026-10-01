import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

function AdminRoute({ children }) {
    const { user, isAuthenticated, isAuthLoading } = useAuth();
    const location = useLocation();

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

    return children;
}

export default AdminRoute;
