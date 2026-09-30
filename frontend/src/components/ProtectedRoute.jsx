import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

function ProtectedRoute({ children }) {
    const { isAuthenticated } = useAuth();
    const location = useLocation();

    if (!isAuthenticated) {
        return (
            <Navigate
                to="/login"
                state={{
                    from: `${location.pathname}${location.search}${location.hash}`
                }}
                replace
            />
        );
    }

    return children;
}

export default ProtectedRoute;
