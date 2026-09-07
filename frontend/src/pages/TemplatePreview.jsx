import { useEffect, useState } from "react";
import {
    Link,
    useNavigate,
    useParams
} from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

import api from "../services/api";

function TemplatePreview() {
const navigate = useNavigate();
    const { id } = useParams();

    const [template, setTemplate] = useState(null);
    const [preview, setPreview] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const { isAuthenticated } = useAuth();

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

            <Link to="/templates">
                ← Back to Templates
            </Link>

            <h1>
                {template.name}
            </h1>

            <p>
                {template.description}
            </p>

            <button
    onClick={() => {

        if (!isAuthenticated) {

            navigate("/login", {
                state: {
                    from: `/templates/${id}`
                }
            });

            return;
        }

        navigate(
            `/builder?template=${id}`
        );

    }}
>
    Use This Template
</button>

            <hr />

            <h2>Live Preview</h2>

            <iframe
                title="Template Preview"
                srcDoc={`
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <style>
                                ${preview.css}
                            </style>
                        </head>

                        <body>

                            ${preview.html}

                            <script>
                                ${preview.js}
                            </script>

                        </body>
                    </html>
                `}
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