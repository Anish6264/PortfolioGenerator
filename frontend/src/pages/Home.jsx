import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../services/api";
import { useAuth } from "../hooks/useAuth";

const professions = [
    ["developer", "Software Developer"],
    ["ml-engineer", "ML Engineer"],
    ["data-scientist", "Data Scientist"],
    ["web-developer", "Web Developer"],
    ["devops", "DevOps Engineer"],
    ["cybersecurity", "Cybersecurity"],
    ["ui-ux", "UI/UX Designer"],
    ["product-manager", "Product Manager"],
    ["company", "Company / Business"]
];

const getGenerationCost = (template) =>
    Math.max(1, template.creditCost || 0);

function Home() {
    const navigate = useNavigate();
    const { user, isAuthenticated, isAuthLoading } = useAuth();
    const [templates, setTemplates] = useState([]);
    const [error, setError] = useState("");
    const [accessMessage, setAccessMessage] = useState("");

    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const response = await api.get("/templates");
                setTemplates(response.data.templates.slice(0, 6));
            } catch (fetchError) {
                console.error(fetchError);
                setError("Featured templates could not be loaded.");
            }
        };

        fetchTemplates();
    }, []);

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

        const cost = getGenerationCost(template);
        if ((user?.credits ?? 0) < cost) {
            setAccessMessage(`You need ${cost} credits to use this template.`);
            return;
        }

        navigate(builderPath);
    };

    return (
        <div>
            <nav>
                <h2>Portfolio Generator</h2>
                <Link to="/templates">Templates</Link>
                {" "}
                <Link to="/professions">Professions</Link>
            </nav>

            <main>
                <h1>Build Your Professional Portfolio</h1>
                <p>
                    Choose a template, add your information,
                    and generate your own HTML, CSS and JavaScript portfolio.
                </p>
                <Link to="/professions">Explore Templates</Link>

                <section>
                    <h2>Browse by profession</h2>
                    {professions.map(([category, label]) => (
                        <p key={category}>
                            <Link to={`/templates?profession=${category}`}>
                                {label}
                            </Link>
                        </p>
                    ))}
                </section>

                <section>
                    <h2>Featured Templates</h2>
                    {error && <p>{error}</p>}
                    {accessMessage && <p role="status">{accessMessage}</p>}
                    <div>
                        {templates.map((template) => (
                            <article key={template._id}>
                                {template.thumbnail && (
                                    <img
                                        src={template.thumbnail}
                                        alt={`${template.name} template preview`}
                                    />
                                )}
                                <h3>{template.name}</h3>
                                <p>Category: {template.category}</p>
                                <p>
                                    {template.isPremium ? "Premium" : "Free"}
                                    {" · "}
                                    {getGenerationCost(template)} credit{getGenerationCost(template) === 1 ? "" : "s"} per generation
                                </p>
                                <Link to={`/templates/${template._id}`}>Preview</Link>
                                {" "}
                                <button
                                    type="button"
                                    onClick={() => handleUseTemplate(template)}
                                >
                                    Use This Template
                                </button>
                            </article>
                        ))}
                    </div>
                    <p><Link to="/templates">View all templates</Link></p>
                </section>
            </main>
        </div>
    );
}

export default Home;
