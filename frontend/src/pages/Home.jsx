import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
import TemplatePricing from "../components/TemplatePricing";
import "./Discovery.css";

const professions = [
    ["developer", "Software Developer", "Create a portfolio for your engineering work.", "</>"],
    ["ml-engineer", "ML Engineer", "Showcase models, research and AI projects.", "✳"],
    ["data-scientist", "Data Scientist", "Present your insights, tools and case studies.", "◉"],
    ["web-developer", "Web Developer", "Put your web experiences front and center.", "⌘"],
    ["devops", "DevOps Engineer", "Highlight the systems you make reliable.", "⌁"],
    ["cybersecurity", "Cybersecurity", "Share your security work and expertise.", "⌑"],
    ["ui-ux", "UI/UX Designer", "Make your design process part of the story.", "◈"],
    ["product-manager", "Product Manager", "Show how you turn strategy into outcomes.", "↗"],
    ["company", "Company / Business", "Give your business a polished web presence.", "◇"]
];
const professionLabels = Object.fromEntries(professions.map(([id, name]) => [id, name]));

function Home() {
    const navigate = useNavigate();
    const { isAuthenticated, isAuthLoading } = useAuth();
    const [templates, setTemplates] = useState([]);
    const [featuredLoading, setFeaturedLoading] = useState(true);
    const [error, setError] = useState("");
    const [accessMessage, setAccessMessage] = useState("");
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        let active = true;
        const fetchTemplates = async () => {
            setFeaturedLoading(true);
            setError("");
            try {
                const response = await api.get("/templates");
                if (active) setTemplates(response.data.templates.slice(0, 6));
            } catch (fetchError) {
                console.error(fetchError);
                if (active) setError("Featured templates could not be loaded. Please try again.");
            } finally {
                if (active) setFeaturedLoading(false);
            }
        };

        void fetchTemplates();
        return () => { active = false; };
    }, [retryCount]);

    const handleUseTemplate = (template) => {
        setAccessMessage("");
        const builderPath = `/builder?template=${encodeURIComponent(template._id)}&profession=${encodeURIComponent(template.category)}`;

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

    return (
        <div className="discovery-page home-page">
            <header className="discovery-header">
                <Link className="brand-mark" to="/" aria-label="Portfolio Generator home">
                    <span className="brand-icon" aria-hidden="true">P</span>
                    <span>Portfolio<span className="brand-light"> Generator</span></span>
                </Link>
                <nav className="discovery-nav" aria-label="Main navigation">
                    <Link to="/professions">Professions</Link>
                    <Link to="/templates">Templates</Link>
                    <Link className="nav-cta" to={isAuthenticated ? "/dashboard" : "/login"}>
                        {isAuthenticated ? "My dashboard" : "Sign in"}
                    </Link>
                </nav>
            </header>

            <main>
                <section className="home-hero discovery-shell">
                    <div className="hero-copy">
                        <p className="eyebrow"><span className="eyebrow-dot" /> Your work deserves a better home</p>
                        <h1>Make your next opportunity <span>find you.</span></h1>
                        <p className="hero-description">
                            Build a portfolio that feels like you. Choose a design, bring your work together, and publish a polished site without starting from scratch.
                        </p>
                        <div className="hero-actions">
                            <Link className="discovery-button discovery-button-primary" to="/professions">Explore portfolios <span aria-hidden="true">→</span></Link>
                            <Link className="discovery-button discovery-button-secondary" to="/templates">Browse templates</Link>
                        </div>
                        <p className="hero-note">A thoughtful first impression, made simple.</p>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                        <div className="hero-orbit hero-orbit-one" />
                        <div className="hero-orbit hero-orbit-two" />
                        <div className="hero-preview-card">
                            <div className="hero-preview-top"><span /><span /><span /><b>your-portfolio.site</b></div>
                            <div className="hero-preview-content">
                                <div className="hero-avatar">A</div>
                                <div className="hero-preview-lines"><i /><i /><i /></div>
                                <div className="hero-preview-work"><i /><i /><i /></div>
                            </div>
                        </div>
                        <div className="hero-float hero-float-left"><span>✦</span> Made to stand out</div>
                        <div className="hero-float hero-float-right"><span>↗</span> Your work, online</div>
                    </div>
                </section>

                <section className="discovery-section discovery-shell" aria-labelledby="profession-heading">
                    <div className="section-heading">
                        <div><p className="eyebrow">A starting point that fits</p><h2 id="profession-heading">Built around your kind of work</h2></div>
                        <Link className="text-link" to="/professions">Explore all professions <span aria-hidden="true">→</span></Link>
                    </div>
                    <div className="profession-grid home-profession-grid">
                        {professions.slice(0, 6).map(([category, label, description, icon], index) => (
                            <Link className="profession-card" key={category} to={`/templates?profession=${category}`} style={{ "--card-index": index }}>
                                <span className="profession-icon" aria-hidden="true">{icon}</span>
                                <span className="profession-card-title">{label}<span aria-hidden="true">↗</span></span>
                                <span className="profession-card-description">{description}</span>
                            </Link>
                        ))}
                    </div>
                </section>

                <section className="discovery-section discovery-shell featured-section" aria-labelledby="featured-heading">
                    <div className="section-heading">
                        <div><p className="eyebrow">Made for a memorable first look</p><h2 id="featured-heading">Find your starting design</h2></div>
                        <Link className="text-link" to="/templates">View all templates <span aria-hidden="true">→</span></Link>
                    </div>
                    {accessMessage && <p className="discovery-feedback" role="status">{accessMessage}</p>}
                    {error && <div className="discovery-state discovery-state-error" role="alert"><p>{error}</p><button type="button" className="discovery-button discovery-button-secondary" onClick={() => setRetryCount((count) => count + 1)}>Try again</button></div>}
                    {featuredLoading ? (
                        <div className="template-grid" aria-label="Loading featured templates" aria-busy="true">
                            {Array.from({ length: 3 }, (_, index) => <div className="template-skeleton" key={index}><div className="skeleton-image" /><div className="skeleton-line skeleton-line-title" /><div className="skeleton-line" /><div className="skeleton-line skeleton-line-short" /></div>)}
                        </div>
                    ) : !error && templates.length === 0 ? (
                        <div className="discovery-state"><span className="empty-state-icon" aria-hidden="true">✦</span><h3>New designs are on the way</h3><p>There are no featured templates to show right now. Browse all designs to see what’s available.</p><Link className="discovery-button discovery-button-secondary" to="/templates">Browse all templates</Link></div>
                    ) : !error ? (
                        <div className="template-grid">
                            {templates.map((template, index) => (
                                <article className="template-card" key={template._id} style={{ "--card-index": index }}>
                                    <Link className="template-image-link" to={`/templates/${template._id}`} aria-label={`Preview ${template.name}`}>
                                        {template.thumbnail ? <img className="template-thumbnail" src={template.thumbnail} alt={`${template.name} template preview`} loading="lazy" /> : <div className="template-thumbnail template-thumbnail-placeholder" aria-hidden="true"><span>{template.name?.charAt(0) || "P"}</span></div>}
                                        <span className="template-image-overlay">Quick preview <span aria-hidden="true">↗</span></span>
                                    </Link>
                                    <div className="template-card-body">
                                        <div className="template-card-heading"><div><p className="template-category">{professionLabels[template.category] || template.category}</p><h3>{template.name}</h3></div><span className="template-spark" aria-hidden="true">✦</span></div>
                                        <TemplatePricing template={template} />
                                        <div className="template-card-actions">
                                            <Link className="discovery-button discovery-button-secondary" to={`/templates/${template._id}`}>Preview</Link>
                                            <button className="discovery-button discovery-button-primary" type="button" onClick={() => handleUseTemplate(template)}>Use template</button>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : null}
                </section>
            </main>

            <footer className="discovery-footer"><Link className="brand-mark" to="/"><span className="brand-icon" aria-hidden="true">P</span><span>Portfolio<span className="brand-light"> Generator</span></span></Link><p>Make your work easy to discover.</p><nav aria-label="Footer navigation"><Link to="/templates">Templates</Link><Link to="/professions">Professions</Link></nav></footer>
        </div>
    );
}

export default Home;
