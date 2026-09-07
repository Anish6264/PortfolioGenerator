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

    useEffect(() => {

        if (token) {

            api.defaults.headers.common.Authorization =
                `Bearer ${token}`;

        } else {

            delete api.defaults.headers.common.Authorization;

        }

    }, [token]);

    const login = (token, user) => {

        localStorage.setItem("token", token);

        setToken(token);
        setUser(user);
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
                isAuthenticated: !!token
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};