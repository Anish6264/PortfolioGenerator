import { useState } from "react";

export default function PasswordInput({ id, label, value, onChange, autoComplete = "new-password" }) {
    const [visible, setVisible] = useState(false);
    return <div className="auth-field">
        <label htmlFor={id}>{label}</label>
        <div className="password-input-wrap">
            <input id={id} type={visible ? "text" : "password"} value={value} onChange={onChange} autoComplete={autoComplete} required />
            <button type="button" className="password-toggle" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Hide password" : "Show password"}>{visible ? "Hide" : "Show"}</button>
        </div>
    </div>;
}
