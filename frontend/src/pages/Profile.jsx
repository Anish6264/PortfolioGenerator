import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
import PasswordInput from "../components/PasswordInput";
import "./Auth.css";
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
        return <main className="account-page"><div className="account-loading" role="status" aria-busy="true"><span className="account-loading-mark" /><span>Loading your account…</span></div></main>;
    }
    if (!user) {
        return (
            <main className="account-page">
                <section className="account-state-card" role="alert">
                    <span className="account-state-icon" aria-hidden="true">!</span>
                    <h1>Account unavailable</h1>
                    <p>Account information could not be loaded. Please sign in again.</p>
                    <Link className="account-action-button" to="/login">Go to sign in</Link>
                </section>
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
                <div className="account-header-copy">
                    <Link className="account-back-link" to="/dashboard">← Back to dashboard</Link>
                    <p className="account-eyebrow">Your workspace</p>
                    <h1>Account settings</h1>
                    <p className="account-identity-name">{user.name}</p>
                    <p className="account-identity-email">{user.email}</p>
                </div>
            </header>

            <section className="account-section account-profile-section" aria-labelledby="account-information-title">
                <div className="account-section-heading"><span className="account-section-icon" aria-hidden="true">◎</span><div><p className="account-eyebrow">Profile</p><h2 id="account-information-title">Personal information</h2></div></div>
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
                    {profileError && <p className="account-notice account-error" role="alert">{profileError}</p>}
                    {profileMessage && <p className="account-notice account-success" role="status">{profileMessage}</p>}
                    <button className="account-primary-button" type="submit" disabled={savingProfile}>
                        {savingProfile && <span className="account-spinner" aria-hidden="true" />}
                        {savingProfile ? "Saving changes…" : "Save changes"}
                    </button>
                </form>
            </section>

            <section className="account-section account-credits-section" aria-labelledby="account-credits-title">
                <div className="account-section-heading"><span className="account-section-icon account-credit-icon" aria-hidden="true">✦</span><div><p className="account-eyebrow">Portfolio tools</p><h2 id="account-credits-title">Your credits</h2></div></div>
                <div className="account-credit-balance"><div><p>Available balance</p><span>{user.credits ?? 0}</span></div><span className="account-credit-unit">credits</span></div>
                <div className="account-actions">
                    <Link className="account-action-button account-action-secondary" to="/credits">View activity</Link>
                    <Link className="account-action-button" to="/buy-credits">Buy credits <span aria-hidden="true">→</span></Link>
                </div>
            </section>

            <section className="account-section" aria-labelledby="account-security-title">
                <div className="account-section-heading"><span className="account-section-icon account-security-icon" aria-hidden="true">⌑</span><div><p className="account-eyebrow">Keep your account safe</p><h2 id="account-security-title">Security</h2></div></div>
                <h3 className="account-subheading">Change password</h3>
                <form className="account-form" onSubmit={handlePasswordSubmit}>
                    <PasswordInput id="profile-current-password" label="Current password" value={passwords.currentPassword} onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))} autoComplete="current-password" />
                    <PasswordInput id="profile-new-password" label="New password" value={passwords.newPassword} onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))} minLength={6} maxLength={128} autoComplete="new-password" />
                    <PasswordInput id="profile-confirm-password" label="Confirm new password" value={passwords.confirmPassword} onChange={(event) => setPasswords((current) => ({ ...current, confirmPassword: event.target.value }))} minLength={6} maxLength={128} autoComplete="new-password" />
                    {passwords.confirmPassword && passwords.newPassword !== passwords.confirmPassword && !passwordError && <p className="account-notice account-error" role="alert">New password and confirmation do not match.</p>}
                    {passwordError && <p className="account-notice account-error" role="alert">{passwordError}</p>}
                    {passwordMessage && <p className="account-notice account-success" role="status">{passwordMessage}</p>}
                    <button className="account-primary-button" type="submit" disabled={changingPassword}>
                        {changingPassword && <span className="account-spinner" aria-hidden="true" />}
                        {changingPassword ? "Changing password…" : "Change password"}
                    </button>
                </form>
            </section>

            <section className="account-section account-logout-section" aria-labelledby="account-session-title">
                <div><p className="account-eyebrow">Session</p><h2 id="account-session-title">Ready to leave?</h2><p className="account-note">You can sign back in any time to continue working.</p></div>
                <button className="account-logout-button" type="button" onClick={handleLogout}>Log out</button>
            </section>
        </main>
    );
}

export default Profile;
