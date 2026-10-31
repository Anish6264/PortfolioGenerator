import { PASSWORD_REQUIREMENTS } from "../utils/passwordValidation";

export default function PasswordRequirements({ password }) {
    return (
        <ul className="password-requirements" aria-label="Password requirements">
            {PASSWORD_REQUIREMENTS.map((rule) => {
                const valid = rule.test(password);
                return <li key={rule.key} className={valid ? "is-valid" : ""} aria-live="polite">
                    <span aria-hidden="true">{valid ? "✓" : "○"}</span> {rule.label}
                </li>;
            })}
        </ul>
    );
}
