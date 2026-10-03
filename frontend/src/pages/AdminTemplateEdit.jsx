import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import api from "../services/api";

const emptyTemplate = {
    name: "",
    description: "",
    category: "",
    thumbnail: "",
    previewUrl: "",
    isPremium: false,
    creditCost: 1,
    isActive: true
};

function AdminTemplateEdit() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [template, setTemplate] = useState(emptyTemplate);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const successNavigationTimer = useRef(null);

    useEffect(() => () => {
        window.clearTimeout(successNavigationTimer.current);
    }, []);

    useEffect(() => {
        let active = true;
        api.get(`/admin/templates/${id}`)
            .then((response) => {
                if (!active) return;
                setTemplate({
                    ...emptyTemplate,
                    ...response.data.template,
                    creditCost: response.data.template.isPremium === true ? response.data.template.creditCost : 1
                });
                setCategories(response.data.categories || []);
            })
            .catch((requestError) => {
                if (active) setError(requestError.response?.data?.message || "Failed to load template.");
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [id]);

    const updateField = (field, value) => {
        setTemplate((current) => ({ ...current, [field]: value }));
    };

    const handlePremiumChange = (event) => {
        const isPremium = event.target.checked;
        setTemplate((current) => ({
            ...current,
            isPremium,
            creditCost: !isPremium ? 1 : Number.isInteger(current.creditCost) && current.creditCost >= 1
                ? current.creditCost
                : 1
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setMessage("");

        if (!template.name.trim() || !template.description.trim() || !categories.includes(template.category)) {
            setError("Enter a name, description, and supported category.");
            return;
        }
        if (!Number.isSafeInteger(template.creditCost) || template.creditCost < 1 || (!template.isPremium && template.creditCost !== 1)) {
            setError("Templates need a positive whole-number credit cost.");
            return;
        }

        setSaving(true);
        try {
            const response = await api.put(`/admin/templates/${id}`, {
                name: template.name,
                description: template.description,
                category: template.category,
                thumbnail: template.thumbnail,
                previewUrl: template.previewUrl,
                isPremium: template.isPremium,
                creditCost: template.isPremium ? template.creditCost : 1,
                isActive: template.isActive
            });
            setTemplate({ ...emptyTemplate, ...response.data.template });
            setMessage("Template updated successfully.");
            successNavigationTimer.current = window.setTimeout(() => {
                navigate("/admin/templates");
            }, 600);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Failed to update template.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <main><p>Loading template…</p></main>;
    if (error && !template.name) {
        return <main><p role="alert">{error}</p><Link to="/admin/templates">Back to templates</Link></main>;
    }

    return (
        <main>
            <p><Link to="/admin/templates">Back to templates</Link></p>
            <h1>Edit Template</h1>
            {error && <p role="alert">{error}</p>}
            {message && <p role="status">{message}</p>}
            <form onSubmit={handleSubmit}>
                <p>
                    <label htmlFor="template-name">Name</label><br />
                    <input id="template-name" value={template.name} maxLength={120} onChange={(event) => updateField("name", event.target.value)} required />
                </p>
                <p>
                    <label htmlFor="template-description">Description</label><br />
                    <textarea id="template-description" value={template.description} maxLength={2000} onChange={(event) => updateField("description", event.target.value)} required />
                </p>
                <p>
                    <label htmlFor="template-category">Category</label><br />
                    <select id="template-category" value={template.category} onChange={(event) => updateField("category", event.target.value)} required>
                        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                </p>
                <p>
                    <label htmlFor="template-thumbnail">Thumbnail URL or reference</label><br />
                    <input id="template-thumbnail" value={template.thumbnail} maxLength={2048} onChange={(event) => updateField("thumbnail", event.target.value)} />
                </p>
                <p>
                    <label htmlFor="template-preview-url">Preview URL or reference</label><br />
                    <input id="template-preview-url" value={template.previewUrl} maxLength={2048} onChange={(event) => updateField("previewUrl", event.target.value)} />
                </p>
                <p>
                    <label>
                        <input type="checkbox" checked={template.isPremium} onChange={handlePremiumChange} />
                        Premium template
                    </label>
                </p>
                <p>
                    <label htmlFor="template-credit-cost">Credit cost</label><br />
                    <input
                        id="template-credit-cost"
                        type="number"
                        min={1}
                        step="1"
                        value={template.creditCost}
                        disabled={!template.isPremium}
                        onChange={(event) => updateField("creditCost", Number(event.target.value))}
                    />
                    <span> credits on first download</span>
                </p>
                <p>
                    <label>
                        <input type="checkbox" checked={template.isActive} onChange={(event) => updateField("isActive", event.target.checked)} />
                        Active and visible to users
                    </label>
                </p>
                <button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save Template"}
                </button>{" "}
                <button type="button" onClick={() => navigate("/admin/templates")}>Cancel</button>
            </form>
        </main>
    );
}

export default AdminTemplateEdit;
