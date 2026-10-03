import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
import "./Profile.css";

const getSafeAvatar = (value) => {
    if (typeof value !== "string" || !value) return "";
    try {
        const parsed = new URL(value);
        return ["http:", "https:"].includes(parsed.protocol) ? value : "";
    } catch {
        return "";
    }
};

function Profile() {
    const navigate = useNavigate();
    const { user, logout, updateUser, isAuthLoading } = useAuth();
    const [form, setForm] = useState(() => ({
        name: user?.name || "",
        email: user?.email || "",
        avatar: user?.avatar || ""
    }));
    const [profileError, setProfileError] = useState("");
    const [profileMessage, setProfileMessage] = useState("");
    const [savingProfile, setSavingProfile] = useState(false);
    const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
    const [passwordError, setPasswordError] = useState("");
    const [passwordMessage, setPasswordMessage] = useState("");
    const [changingPassword, setChangingPassword] = useState(false);

    const safeAvatar = getSafeAvatar(user?.avatar);
    const initial = user?.name?.trim()?.charAt(0)?.toUpperCase() || "?";

    const handleProfileChange = (event) => {
        setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    };

    const handleProfileSubmit = async (event) => {
        event.preventDefault();
        if (savingProfile) return;
        setSavingProfile(true);
        setProfileError("");
        setProfileMessage("");
        try {
            const response = await api.put("/auth/profile", {
                name: form.name,
                email: form.email,
                avatar: form.avatar
            });
            updateUser(response.data.user);
            setForm({
                name: response.data.user.name || "",
                email: response.data.user.email || "",
                avatar: response.data.user.avatar || ""
            });
            setProfileMessage("Your account information has been updated.");
        } catch (requestError) {
            setProfileError(requestError.response?.data?.message || "Unable to update your account information.");
        } finally {
            setSavingProfile(false);
        }
    };

    const handlePasswordSubmit = async (event) => {
        event.preventDefault();
        if (changingPassword) return;
        setPasswordError("");
        setPasswordMessage("");
        if (passwords.newPassword !== passwords.confirmPassword) {
            setPasswordError("New password and confirmation do not match.");
            return;
        }

        setChangingPassword(true);
        try {
            await api.patch("/auth/change-password", {
                currentPassword: passwords.currentPassword,
                newPassword: passwords.newPassword
            });
            setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
            setPasswordMessage("Your password has been changed.");
        } catch (requestError) {
            setPasswordError(requestError.response?.data?.message || "Unable to change your password.");
        } finally {
            setChangingPassword(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate("/login", { replace: true });
    };

    if (isAuthLoading) {
        return <main className="account-page"><p role="status">Loading account…</p></main>;
    }
    if (!user) {
        return (
            <main className="account-page">
                <h1>Account</h1>
                <p role="alert">Account information could not be loaded. Please sign in again.</p>
                <Link to="/login">Go to Login</Link>
            </main>
        );
    }

    return (
        <main className="account-page">
            <header className="account-header">
                <div className="account-avatar" aria-label={safeAvatar ? undefined : "Avatar initial " + (user.name?.charAt(0) || "?")}>
                    {safeAvatar
                        ? <img src={safeAvatar} alt={user.name + "'s account avatar"} />
                        : <span aria-hidden="true">{initial}</span>}
                </div>
                <div>
                    <p><Link to="/dashboard">← Back to Dashboard</Link></p>
                    <h1>Account / Profile</h1>
                    <p>{user.name}</p>
                    <p>{user.email}</p>
                </div>
            </header>

            <section className="account-section">
                <h2>Personal Information</h2>
                <p className="account-note">These details belong to your account. Portfolio name and email are managed separately in each portfolio.</p>
                <form className="account-form" onSubmit={handleProfileSubmit}>
                    <label>
                        Name
                        <input name="name" type="text" value={form.name} onChange={handleProfileChange} maxLength={100} autoComplete="name" required />
                    </label>
                    <label>
                        Email
                        <input name="email" type="email" value={form.email} onChange={handleProfileChange} maxLength={254} autoComplete="email" required />
                    </label>
                    <label>
                        Avatar URL
                        <input name="avatar" type="url" value={form.avatar} onChange={handleProfileChange} maxLength={2048} placeholder="https://example.com/avatar.jpg" />
                    </label>
                    {profileError && <p className="account-error" role="alert">{profileError}</p>}
                    {profileMessage && <p className="account-success" role="status">{profileMessage}</p>}
                    <button type="submit" disabled={savingProfile}>{savingProfile ? "Saving…" : "Save Changes"}</button>
                </form>
            </section>

            <section className="account-section">
                <h2>Credits</h2>
                <p className="account-credit-balance"><strong>Available Credits</strong><span>{user.credits ?? 0}</span></p>
                <div className="account-actions">
                    <Link to="/credits">View Credits &amp; Billing</Link>
                    <Link to="/buy-credits">Buy Credits</Link>
                </div>
            </section>

            <section className="account-section">
                <h2>Security</h2>
                <h3>Change Password</h3>
                <form className="account-form" onSubmit={handlePasswordSubmit}>
                    <label>
                        Current Password
                        <input type="password" value={passwords.currentPassword} onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))} autoComplete="current-password" required />
                    </label>
                    <label>
                        New Password
                        <input type="password" value={passwords.newPassword} onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))} minLength={6} maxLength={128} autoComplete="new-password" required />
                    </label>
                    <label>
                        Confirm New Password
                        <input type="password" value={passwords.confirmPassword} onChange={(event) => setPasswords((current) => ({ ...current, confirmPassword: event.target.value }))} minLength={6} maxLength={128} autoComplete="new-password" required />
                    </label>
                    {passwordError && <p className="account-error" role="alert">{passwordError}</p>}
                    {passwordMessage && <p className="account-success" role="status">{passwordMessage}</p>}
                    <button type="submit" disabled={changingPassword}>{changingPassword ? "Changing Password…" : "Change Password"}</button>
                </form>
            </section>

            <section className="account-section account-logout-section">
                <h2>Account</h2>
                <button type="button" onClick={handleLogout}>Log Out</button>
            </section>
        </main>
    );
}

export default Profile;
