import { useEffect, useState } from "react";
import {
    Link,
    useLocation,
    useNavigate,
    useParams
} from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

import api from "../services/api";
import TemplatePricing from "../components/TemplatePricing";

const categoryLabels = {
    developer: "Software Developer",
    "ml-engineer": "ML Engineer",
    "data-scientist": "Data Scientist",
    "web-developer": "Web Developer",
    devops: "DevOps Engineer",
    cybersecurity: "Cybersecurity",
    "ui-ux": "UI/UX Designer",
    "product-manager": "Product Manager",
    company: "Company / Business"
};

function TemplatePreview() {
const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();

    const [template, setTemplate] = useState(null);
    const [preview, setPreview] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const { isAuthenticated, isAuthLoading } = useAuth();
    const [accessMessage, setAccessMessage] = useState("");

    useEffect(() => {

        const fetchData = async () => {

            try {

                const templateResponse =
                    await api.get(`/templates/${id}`);

                const previewResponse =
                    await api.get(
                        `/templates/${id}/preview`
                    );

                setTemplate(
                    templateResponse.data.template
                );

                setPreview(
                    previewResponse.data
                );

            } catch (error) {

                console.error(error);

                setError("Unable to load template");

            } finally {

                setLoading(false);
            }
        };

        fetchData();

    }, [id]);

    if (loading) {
        return <h2>Loading preview...</h2>;
    }

    if (error) {
        return <h2>{error}</h2>;
    }

    return (
        <div>

            <Link to={`/templates${location.search}`}>
                ← Back to Templates
            </Link>

            <h1>
                {template.name}
            </h1>

            <p>
                {template.description}
            </p>

            <p>
                Category: {categoryLabels[template.category] || template.category}
            </p>

            <TemplatePricing template={template} />

            {accessMessage && <p role="status">{accessMessage}</p>}

            <button
                onClick={() => {
                    const builderPath = `/builder?template=${encodeURIComponent(id)}&profession=${encodeURIComponent(template.category)}`;

                    if (isAuthLoading) {
                        setAccessMessage("Your account is still loading. Please try again shortly.");
                        return;
                    }

                    if (!isAuthenticated) {
                        navigate("/login", { state: { from: builderPath } });
                        return;
                    }

                    navigate(builderPath);
                }}
            >
                Use This Template
            </button>

            <hr />

            <h2>Live Preview</h2>

            <iframe
                title="Template Preview"
                sandbox="allow-scripts"
                srcDoc={preview.html
                    .replace(/<link\b[^>]*href=["']style\.css["'][^>]*>/i, `<style>${preview.css}</style>`)
                    .replace(/<script\b[^>]*src=["']script\.js["'][^>]*><\/script>/i, `<script>${preview.js}</script>`)}
                style={{
                    width: "100%",
                    height: "800px",
                    border: "1px solid #ddd"
                }}
            />

        </div>
    );
}

export default TemplatePreview;
