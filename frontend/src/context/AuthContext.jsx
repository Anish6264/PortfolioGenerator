import {
    useEffect,
    useState
} from "react";

import api from "../services/api";
import AuthContext from "./AuthContextValue";

export const AuthProvider = ({ children }) => {

    const [user, setUser] = useState(null);

    const [token, setToken] = useState(
        localStorage.getItem("token")
    );

    const [isAuthLoading, setIsAuthLoading] = useState(
        () => !!localStorage.getItem("token")
    );

    useEffect(() => {

        if (token) {

            api.defaults.headers.common.Authorization =
                `Bearer ${token}`;

        } else {

            delete api.defaults.headers.common.Authorization;

        }

    }, [token]);

    useEffect(() => {
        const restoreUser = async () => {
            if (!token) {
                setIsAuthLoading(false);
                return;
            }

            try {
                const response = await api.get("/auth/me");
                setUser(response.data.user);
            } catch (error) {
                if (error.response?.status === 401 || error.response?.status === 404) {
                    localStorage.removeItem("token");
                    setToken(null);
                    setUser(null);
                }
            } finally {
                setIsAuthLoading(false);
            }
        };

        restoreUser();
    }, []);

    const login = (token, user) => {

        localStorage.setItem("token", token);

        setToken(token);
        setUser(user);
        setIsAuthLoading(false);
    };

    const logout = () => {

        localStorage.removeItem("token");

        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                login,
                logout,
                isAuthenticated: !!token,
                isAuthLoading
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
