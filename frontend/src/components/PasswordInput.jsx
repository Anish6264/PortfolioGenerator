import { useState } from "react";

export default function PasswordInput({
    id,
    label,
    value,
    onChange,
    autoComplete = "new-password",
    minLength,
    maxLength
}) {
    const [visible, setVisible] = useState(false);
    return (
        <div className="auth-field">
            <label htmlFor={id}>{label}</label>
            <div className="password-input-wrap">
                <input
                    id={id}
                    type={visible ? "text" : "password"}
                    value={value}
                    onChange={onChange}
                    autoComplete={autoComplete}
                    minLength={minLength}
                    maxLength={maxLength}
                    required
                />
                <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setVisible((current) => !current)}
                    aria-label={visible ? "Hide password" : "Show password"}
                    aria-pressed={visible}
                    title={visible ? "Hide password" : "Show password"}
                >
                    {visible ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 8.7 4.5 9.5 6-.4.8-1.4 2.2-3 3.5M6.2 6.2C3.9 7.6 2.8 9.6 2.5 11c.8 1.5 4.3 6 9.5 6 1 0 2-.2 2.8-.5" /></svg>
                    ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>
                    )}
                </button>
            </div>
        </div>
    );
}
