import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import "./AdminLayout.css";

const sections = [
    { label: "Overview", to: "/admin", end: true, icon: "◫" },
    { label: "Users", to: "/admin/users", icon: "◉" },
    { label: "Portfolios", to: "/admin/portfolios", icon: "▤" },
    { label: "Payments", to: "/admin/payments", icon: "◇" },
    { label: "Credit activity", to: "/admin/credit-transactions", icon: "↗" },
    { label: "Templates", to: "/admin/templates", icon: "▦" }
];

function AdminLayout({ children }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const section = [...sections].reverse().find((item) => item.to !== "/admin" && location.pathname.startsWith(item.to));
    const current = section?.label || "Overview";

    const handleLogout = () => {
        logout();
        navigate("/login", { replace: true });
    };

    return (
        <div className="admin-shell">
            <aside className="admin-shell-sidebar" aria-label="Admin workspace">
                <NavLink className="admin-shell-brand" to="/admin" end>
                    <span className="admin-shell-mark" aria-hidden="true">P</span>
                    <span><strong>Portfolio</strong><small>ADMIN WORKSPACE</small></span>
                </NavLink>
                <p className="admin-shell-nav-label">WORKSPACE</p>
                <nav className="admin-shell-nav" aria-label="Admin navigation">
                    {sections.map(({ label, to, end, icon }) => (
                        <NavLink key={to} to={to} end={end} className={({ isActive }) => `admin-shell-link${isActive ? " is-active" : ""}`}>
                            <span aria-hidden="true">{icon}</span>{label}
                        </NavLink>
                    ))}
                </nav>
                <div className="admin-shell-sidebar-footer">
                    <span className="admin-shell-avatar" aria-hidden="true">{(user?.name || "A").charAt(0).toUpperCase()}</span>
                    <span className="admin-shell-identity"><strong>{user?.name || "Administrator"}</strong><small>Administrator</small></span>
                    <button className="admin-shell-logout" type="button" onClick={handleLogout} aria-label="Log out">↗</button>
                </div>
            </aside>
            <div className="admin-shell-main">
                <header className="admin-shell-topbar">
                    <div><span>Admin workspace</span><span className="admin-shell-breadcrumb">/ {current}</span></div>
                    <span className="admin-shell-secure"><span aria-hidden="true">●</span> Secure session</span>
                </header>
                <div className="admin-shell-page">{children}</div>
            </div>
        </div>
    );
}

export default AdminLayout;
