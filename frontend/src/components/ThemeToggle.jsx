import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const initialTheme = () => document.documentElement.dataset.theme === "dark" ? "dark" : "light";

export default function ThemeToggle() {
    const [theme, setTheme] = useState(initialTheme);
    const location = useLocation();

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        try {
            localStorage.setItem("portfolio-generator-theme", theme);
        } catch {
            // Theme still works for this session when browser storage is unavailable.
        }
    }, [theme]);

    if (location.pathname.startsWith("/p/")) return null;

    const nextTheme = theme === "dark" ? "light" : "dark";
    return (
        <button
            className="theme-toggle"
            type="button"
            onClick={() => setTheme(nextTheme)}
            aria-label={`Switch to ${nextTheme} theme`}
            aria-pressed={theme === "dark"}
            title={`Switch to ${nextTheme} theme`}
        >
            <span className="theme-toggle-icon" aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
        </button>
    );
}
