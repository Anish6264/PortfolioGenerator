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
import "./Discovery.css";

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
    const [retryCount, setRetryCount] = useState(0);
    const { isAuthenticated, isAuthLoading } = useAuth();
    const [accessMessage, setAccessMessage] = useState("");

    useEffect(() => {
        let active = true;
        const fetchData = async () => {
            setLoading(true);
            setError("");
            try {
                const templateResponse = await api.get(`/templates/${id}`);
                const previewResponse = await api.get(`/templates/${id}/preview`);
                if (active) {
                    setTemplate(templateResponse.data.template);
                    setPreview(previewResponse.data);
                }
            } catch (requestError) {
                console.error(requestError);
                if (active) setError("This template preview could not be loaded. Please try again.");
            } finally {
                if (active) setLoading(false);
            }
        };

        void fetchData();
        return () => { active = false; };
    }, [id, retryCount]);

    const handleUseTemplate = () => {
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
    };

    if (loading) {
        return (
            <main className="discovery-page preview-page">
                <header className="discovery-header"><Link className="brand-mark" to="/" aria-label="Portfolio Generator home"><span className="brand-icon" aria-hidden="true">P</span><span>Portfolio<span className="brand-light"> Generator</span></span></Link></header>
                <section className="discovery-shell preview-loading" role="status" aria-live="polite" aria-busy="true">
                    <div className="preview-loading-copy"><div className="skeleton-line skeleton-line-short" /><div className="skeleton-line skeleton-line-title" /><div className="skeleton-line" /><div className="skeleton-line skeleton-line-short" /></div>
                    <div className="preview-skeleton-frame"><div className="preview-skeleton-bar" /><div className="skeleton-image" /></div>
                    <span className="visually-hidden">Loading template preview…</span>
                </section>
            </main>
        );
    }

    if (error || !template || !preview) {
        return (
            <main className="discovery-page preview-page">
                <header className="discovery-header"><Link className="brand-mark" to="/" aria-label="Portfolio Generator home"><span className="brand-icon" aria-hidden="true">P</span><span>Portfolio<span className="brand-light"> Generator</span></span></Link></header>
                <section className="discovery-shell discovery-state discovery-state-error preview-error" role="alert">
                    <span className="empty-state-icon" aria-hidden="true">!</span>
                    <h1>Preview unavailable</h1>
                    <p>{error || "This template could not be found."}</p>
                    <div className="preview-error-actions"><button className="discovery-button discovery-button-primary" type="button" onClick={() => setRetryCount((count) => count + 1)}>Try again</button><Link className="discovery-button discovery-button-secondary" to={`/templates${location.search}`}>Back to templates</Link></div>
                </section>
            </main>
        );
    }

    return (
        <main className="discovery-page preview-page">
            <header className="discovery-header">
                <Link className="brand-mark" to="/" aria-label="Portfolio Generator home"><span className="brand-icon" aria-hidden="true">P</span><span>Portfolio<span className="brand-light"> Generator</span></span></Link>
                <nav className="discovery-nav" aria-label="Main navigation"><Link to={`/templates${location.search}`}>All templates</Link><Link className="nav-cta" to="/professions">Professions</Link></nav>
            </header>
            <section className="discovery-shell preview-layout">
                <div className="preview-details">
                    <Link className="back-link" to={`/templates${location.search}`}>← Back to templates</Link>
                    <p className="eyebrow">Template preview</p>
                    <h1>{template.name}</h1>
                    <p className="preview-description">{template.description}</p>
                    <p className="template-category preview-category">{categoryLabels[template.category] || template.category}</p>
                    <TemplatePricing template={template} />
                    {accessMessage && <p className="discovery-feedback" role="status">{accessMessage}</p>}
                    <button className="discovery-button discovery-button-primary preview-use-button" type="button" onClick={handleUseTemplate}>Use this template <span aria-hidden="true">→</span></button>
                    <p className="preview-action-note">You can personalize the details after choosing a design.</p>
                </div>
                <section className="preview-showcase" aria-label="Live template preview">
                    <div className="preview-browser-frame">
                        <div className="preview-browser-toolbar" aria-hidden="true"><div className="preview-browser-dots"><i /><i /><i /></div><div className="preview-browser-address">portfolio preview</div><span className="preview-browser-menu">•••</span></div>
                        <iframe
                            className="template-live-preview"
                            title={`${template.name} live preview`}
                            sandbox="allow-scripts"
                            srcDoc={preview.html
                                .replace(/<link\b[^>]*href=["']style\.css["'][^>]*>/i, `<style>${preview.css}</style>`)
                                .replace(/<script\b[^>]*src=["']script\.js["'][^>]*><\/script>/i, `<script>${preview.js}</script>`)}
                        />
                    </div>
                    <p className="preview-caption">A live look at your selected design</p>
                </section>
            </section>
        </main>
    );
}

export default TemplatePreview;
