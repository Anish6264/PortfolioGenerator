import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:5000/api" : "/api")
});

api.interceptors.request.use((config) => {
    const token = sessionStorage.getItem("adminVerificationToken");
    if (token) config.headers["X-Admin-Verification"] = token;
    return config;
});

api.interceptors.response.use((response) => response, (error) => {
    if (error.response?.data?.code === "ADMIN_VERIFICATION_REQUIRED") {
        sessionStorage.removeItem("adminVerificationToken");
        window.dispatchEvent(new Event("admin-verification-invalid"));
    }
    return Promise.reject(error);
});

export default api;
