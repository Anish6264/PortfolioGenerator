import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
import TemplatePricing from "../components/TemplatePricing";
import "./Discovery.css";

const categories = [
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
const categoryLabels = Object.fromEntries(categories);

function Templates() {
    const navigate = useNavigate();
    const { isAuthenticated, isAuthLoading } = useAuth();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [accessMessage, setAccessMessage] = useState("");
    const [retryCount, setRetryCount] = useState(0);
    const [searchParams] = useSearchParams();
    const profession = searchParams.get("profession") || searchParams.get("category");

    const handleUseTemplate = (template) => {
        setAccessMessage("");
        const professionQuery = profession ? `&profession=${encodeURIComponent(profession)}` : "";
        const builderPath = `/builder?template=${encodeURIComponent(template._id)}${professionQuery}`;

        if (isAuthLoading) {
            setAccessMessage("Your account is still loading. Please try again shortly.");
            return;
        }

        if (!isAuthenticated) {
            navigate("/login", { state: { from: builderPath } });
            return;
        }

        navigate(builderPath);
    };

    useEffect(() => {
        let active = true;
        const fetchTemplates = async () => {
            setLoading(true);
            setError("");
            try {
                const response = await api.get("/templates", {
                    params: profession ? { profession } : {}
                });
                if (active) setTemplates(response.data.templates);
            } catch (requestError) {
                console.error(requestError);
                if (active) setError("Templates could not be loaded. Check your connection and try again.");
            } finally {
                if (active) setLoading(false);
            }
        };

        void fetchTemplates();
        return () => { active = false; };
    }, [profession, retryCount]);

    return (
        <main className="discovery-page templates-page">
            <header className="discovery-header">
                <Link className="brand-mark" to="/" aria-label="Portfolio Generator home"><span className="brand-icon" aria-hidden="true">P</span><span>Portfolio<span className="brand-light"> Generator</span></span></Link>
                <nav className="discovery-nav" aria-label="Main navigation"><Link to="/professions">Professions</Link><Link className="nav-cta" to="/">Home</Link></nav>
            </header>
            <section className="discovery-shell discovery-page-intro templates-intro">
                <Link className="back-link" to="/professions">← Change profession</Link>
                <p className="eyebrow">A design to make your own</p>
                <h1>{profession ? `${categoryLabels[profession] || profession} templates` : "Choose your starting design"}</h1>
                <p className="page-intro-copy">Explore thoughtful layouts, then make one yours with your work and story.</p>
            </section>

            <section className="discovery-shell template-browser" aria-label="Browse portfolio templates">
                <nav className="category-filters" aria-label="Filter templates by profession">
                    <Link className={`category-filter${!profession ? " is-active" : ""}`} to="/templates" aria-current={!profession ? "page" : undefined}>All templates</Link>
                    {categories.map(([id, name]) => (
                        <Link className={`category-filter${profession === id ? " is-active" : ""}`} key={id} to={`/templates?profession=${id}`} aria-current={profession === id ? "page" : undefined}>{name}</Link>
                    ))}
                </nav>
                {accessMessage && <p className="discovery-feedback" role="status">{accessMessage}</p>}
                {loading ? (
                    <div className="template-grid" aria-label="Loading templates" aria-busy="true">
                        {Array.from({ length: 6 }, (_, index) => <div className="template-skeleton" key={index}><div className="skeleton-image" /><div className="skeleton-line skeleton-line-title" /><div className="skeleton-line" /><div className="skeleton-line skeleton-line-short" /></div>)}
                    </div>
                ) : error ? (
                    <div className="discovery-state discovery-state-error" role="alert"><span className="empty-state-icon" aria-hidden="true">!</span><h2>We couldn’t find the templates</h2><p>{error}</p><button className="discovery-button discovery-button-primary" type="button" onClick={() => setRetryCount((count) => count + 1)}>Try again</button></div>
                ) : templates.length === 0 ? (
                    <div className="discovery-state"><span className="empty-state-icon" aria-hidden="true">✦</span><h2>No templates in this collection yet</h2><p>Try another profession or view all available designs.</p><Link className="discovery-button discovery-button-secondary" to="/templates">View all templates</Link></div>
                ) : (
                    <div className="template-grid" aria-live="polite">
                        {templates.map((template, index) => (
                            <article className="template-card" key={template._id} style={{ "--card-index": index }}>
                                <Link className="template-image-link" to={`/templates/${template._id}${profession ? `?profession=${encodeURIComponent(profession)}` : ""}`} aria-label={`Preview ${template.name}`}>
                                    {template.thumbnail ? <img className="template-thumbnail" src={template.thumbnail} alt={`${template.name} template preview`} loading="lazy" /> : <div className="template-thumbnail template-thumbnail-placeholder" aria-hidden="true"><span>{template.name?.charAt(0) || "P"}</span></div>}
                                    <span className="template-image-overlay">Preview design <span aria-hidden="true">↗</span></span>
                                </Link>
                                <div className="template-card-body">
                                    <div className="template-card-heading"><div><p className="template-category">{categoryLabels[template.category] || template.category}</p><h2>{template.name}</h2></div><span className="template-spark" aria-hidden="true">✦</span></div>
                                    <p className="template-description">{template.description || "A considered layout for sharing your work and experience."}</p>
                                    <TemplatePricing template={template} />
                                    <div className="template-card-actions">
                                        <Link className="discovery-button discovery-button-secondary" to={`/templates/${template._id}${profession ? `?profession=${encodeURIComponent(profession)}` : ""}`}>Preview</Link>
                                        <button className="discovery-button discovery-button-primary" type="button" onClick={() => handleUseTemplate(template)}>Use template</button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
            <footer className="discovery-footer"><Link className="brand-mark" to="/"><span className="brand-icon" aria-hidden="true">P</span><span>Portfolio<span className="brand-light"> Generator</span></span></Link><p>Make your work easy to discover.</p><Link to="/professions">Browse professions →</Link></footer>
        </main>
    );
}

export default Templates;
