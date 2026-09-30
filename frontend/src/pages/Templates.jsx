import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import api from "../services/api";
import { useAuth } from "../hooks/useAuth";

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

function Templates() {
    const navigate = useNavigate();
    const { user, isAuthenticated, isAuthLoading } = useAuth();

    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [accessMessage, setAccessMessage] = useState("");

    const [searchParams] = useSearchParams();

    const profession =
        searchParams.get("profession") ||
        searchParams.get("category");

    const handleUseTemplate = (template) => {
        setAccessMessage("");
        const builderPath = `/builder?template=${encodeURIComponent(template._id)}`;

        if (isAuthLoading) {
            setAccessMessage("Your account is still loading. Please try again shortly.");
            return;
        }

        if (!isAuthenticated) {
            navigate("/login", { state: { from: builderPath } });
            return;
        }

        const cost = Math.max(1, template.creditCost || 0);
        if ((user?.credits ?? 0) < cost) {
            setAccessMessage(`You need ${cost} credits to use this template.`);
            return;
        }

        navigate(builderPath);
    };

    useEffect(() => {

        const fetchTemplates = async () => {

            try {

                const response = await api.get("/templates", {
                    params: profession ? { profession } : {}
                });

                setTemplates(response.data.templates);

            } catch (error) {

                console.error(error);

                setError("Failed to load templates");

            } finally {

                setLoading(false);
            }
        };

        fetchTemplates();

    }, [profession]);

    if (loading) {
        return <h2>Loading templates...</h2>;
    }

    if (error) {
        return <h2>{error}</h2>;
    }

    return (
        <div>

            <Link to="/professions">
                ← Change Profession
            </Link>

            <h1>
                {profession
                    ? `${categoryLabels[profession] || profession} Templates`
                    : "Choose Your Template"}
            </h1>

            {accessMessage && <p role="status">{accessMessage}</p>}

            {templates.length === 0 ? (

                <p>
                    No templates available for this profession yet.
                </p>

            ) : (

                <div>

                    {templates.map((template) => (

                        <div key={template._id}>

                            {template.thumbnail && (
                                <img
                                    src={template.thumbnail}
                                    alt={`${template.name} template preview`}
                                />
                            )}

                            <h2>
                                {template.name}
                            </h2>

                            <p>
                                {template.description}
                            </p>

                            <p>
                                Category: {
                                    categoryLabels[template.category] ||
                                    template.category
                                }
                            </p>

                            <p>
                                {template.isPremium ? "Premium" : "Free"}
                                {" · "}
                                {Math.max(1, template.creditCost || 0)} credit{Math.max(1, template.creditCost || 0) === 1 ? "" : "s"} per generation
                            </p>

                            <Link
                                to={`/templates/${template._id}${profession
                                    ? `?profession=${encodeURIComponent(profession)}`
                                    : ""}`}
                            >
                                Preview
                            </Link>

                            {" "}

                            <button
                                type="button"
                                onClick={() => handleUseTemplate(template)}
                            >
                                Use This Template
                            </button>

                        </div>

                    ))}

                </div>
            )}

        </div>
    );
}

export default Templates;
