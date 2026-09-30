import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import api from "../services/api";

function PortfolioPreview() {

    const { id } = useParams();

    const navigate = useNavigate();

    const [html, setHtml] = useState("");

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState("");


    useEffect(() => {

        const fetchPreview = async () => {

            try {

                setLoading(true);

                setError("");

                const response = await api.get(
                    `/generator/${id}/preview`
                );

                setHtml(
                    response.data.html
                );

            } catch (error) {

                console.error(error);

                setError(
                    error.response?.data?.message ||
                    "Failed to load portfolio preview"
                );

            } finally {

                setLoading(false);

            }
        };

        fetchPreview();

    }, [id]);


    if (loading) {

        return (
            <div>
                <h2>
                    Loading portfolio preview...
                </h2>
            </div>
        );

    }


    if (error) {

        return (
            <div>

                <h2>
                    Unable to load preview
                </h2>

                <p>
                    {error}
                </p>

                <button
                    onClick={() =>
                        navigate("/dashboard")
                    }
                >
                    Back to Dashboard
                </button>

            </div>
        );

    }


    return (
        <div>

            <header>

                <button
                    onClick={() =>
                        navigate("/dashboard")
                    }
                >
                    ← Back to Dashboard
                </button>

                <h1>
                    Portfolio Preview
                </h1>

            </header>


            <main>

                <iframe
                    title="Portfolio Preview"
                    srcDoc={html}
                    style={{
                        width: "100%",
                        minHeight: "90vh",
                        border: "none"
                    }}
                />

            </main>

        </div>
    );
}

export default PortfolioPreview;