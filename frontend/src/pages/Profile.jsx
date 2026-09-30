import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../hooks/useAuth";

function Profile() {
    const { user, refreshUser, updateUser } = useAuth();
    const [form, setForm] = useState({ name: user?.name || "", email: user?.email || "", avatar: user?.avatar || "" });
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [saving, setSaving] = useState(false);

    let safeAvatar = false;
    if (user?.avatar) {
        try {
            safeAvatar = ["http:", "https:"].includes(new URL(user.avatar).protocol);
        } catch {
            safeAvatar = false;
        }
    }

    const handleChange = (event) => {
        setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        setMessage("");
        try {
            const response = await api.put("/auth/profile", form);
            updateUser(response.data.user);
            setForm({ name: response.data.user.name || "", email: response.data.user.email || "", avatar: response.data.user.avatar || "" });
            try {
                await refreshUser();
            } catch (refreshError) {
                console.error("Profile updated, but refreshing the session data failed:", refreshError);
            }
            setMessage("Profile updated successfully.");
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to update profile.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <main>
            <h1>Account Profile</h1>
            <p>Credits: {user?.credits ?? 0}</p>
            {safeAvatar && <img src={user.avatar} alt="Profile avatar" width="96" height="96" />}
            <form onSubmit={handleSubmit}>
                <label>
                    Name
                    <input name="name" value={form.name} onChange={handleChange} maxLength={100} required />
                </label>
                <label>
                    Email
                    <input name="email" type="email" value={form.email} onChange={handleChange} maxLength={254} required />
                </label>
                <label>
                    Avatar URL
                    <input name="avatar" type="url" value={form.avatar} onChange={handleChange} maxLength={2048} />
                </label>
                {error && <p role="alert">{error}</p>}
                {message && <p role="status">{message}</p>}
                <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Profile"}</button>
            </form>
            <p><Link to="/dashboard">Back to Dashboard</Link></p>
        </main>
    );
}

export default Profile;
