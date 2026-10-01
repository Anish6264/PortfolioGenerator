import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../services/api";

function AdminTemplates() {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [workingId, setWorkingId] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        let active = true;
        api.get("/admin/templates")
            .then((response) => {
                if (active) setTemplates(response.data.templates || []);
            })
            .catch((requestError) => {
                if (active) setError(requestError.response?.data?.message || "Failed to load templates.");
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    const toggleActive = async (template) => {
        setWorkingId(template._id);
        setError("");
        setMessage("");
        try {
            const response = await api.put(`/admin/templates/${template._id}`, {
                isActive: !template.isActive
            });
            setTemplates((current) => current.map((item) =>
                item._id === template._id ? response.data.template : item
            ));
            setMessage(`${template.name} ${template.isActive ? "deactivated" : "activated"}.`);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Failed to update template status.");
        } finally {
            setWorkingId("");
        }
    };

    if (loading) return <main><p>Loading templates…</p></main>;

    return (
        <main>
            <p><Link to="/dashboard">Back to Dashboard</Link></p>
            <h1>Template Management</h1>
            <p>Manage template details, credit costs, and availability.</p>
            {error && <p role="alert">{error}</p>}
            {message && <p role="status">{message}</p>}

            <table>
                <thead>
                    <tr>
                        <th scope="col">Template</th>
                        <th scope="col">Category</th>
                        <th scope="col">Access</th>
                        <th scope="col">Cost</th>
                        <th scope="col">Status</th>
                        <th scope="col">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {templates.map((template) => (
                        <tr key={template._id}>
                            <td>{template.name}</td>
                            <td>{template.category}</td>
                            <td>{template.isPremium ? "Premium" : "Free"}</td>
                            <td>{template.creditCost} credits</td>
                            <td>{template.isActive ? "Active" : "Inactive"}</td>
                            <td>
                                <Link to={`/admin/templates/${template._id}/edit`}>Edit</Link>{" "}
                                <button
                                    type="button"
                                    onClick={() => toggleActive(template)}
                                    disabled={workingId === template._id}
                                >
                                    {workingId === template._id
                                        ? "Updating…"
                                        : template.isActive ? "Deactivate" : "Activate"}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </main>
    );
}

export default AdminTemplates;
