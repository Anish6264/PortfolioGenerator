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
        let active = true;
        const restoreUser = async () => {
            if (!token) {
                if (active) setIsAuthLoading(false);
                return;
            }

            try {
                const response = await api.get("/auth/me");
                if (active) setUser(response.data.user);
            } catch (error) {
                if (active && (error.response?.status === 401 || error.response?.status === 404)) {
                    localStorage.removeItem("token");
                    setToken(null);
                    setUser(null);
                }
            } finally {
                if (active) setIsAuthLoading(false);
            }
        };

        void restoreUser();
        return () => { active = false; };
    }, [token]);

    useEffect(() => {
        const handleStorage = (event) => {
            if (event.key !== "token") return;
            setToken(event.newValue);
            setUser(null);
            setIsAuthLoading(Boolean(event.newValue));
        };
        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
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
        setIsAuthLoading(false);
    };

    const refreshUser = async () => {
        const response = await api.get("/auth/me");
        setUser(response.data.user);
        return response.data.user;
    };

    const updateUser = (updatedUser) => {
        setUser(updatedUser);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                login,
                logout,
                refreshUser,
                updateUser,
                isAuthenticated: !!token,
                isAuthLoading
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
