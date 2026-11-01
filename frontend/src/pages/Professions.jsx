import { Link } from "react-router-dom";
import "./Discovery.css";

const professions = [
    { id: "developer", name: "Software Developer", description: "For software and full-stack developers.", icon: "</>" },
    { id: "ml-engineer", name: "ML Engineer", description: "For machine learning and AI professionals.", icon: "✳" },
    { id: "data-scientist", name: "Data Scientist", description: "For data science and analytics professionals.", icon: "◉" },
    { id: "web-developer", name: "Web Developer", description: "For frontend and web developers.", icon: "⌘" },
    { id: "devops", name: "DevOps Engineer", description: "For cloud and DevOps professionals.", icon: "⌁" },
    { id: "cybersecurity", name: "Cybersecurity", description: "For security professionals.", icon: "⌑" },
    { id: "ui-ux", name: "UI/UX Designer", description: "For designers and creative professionals.", icon: "◈" },
    { id: "product-manager", name: "Product Manager", description: "For product and business professionals.", icon: "↗" },
    { id: "company", name: "Company / Business", description: "For businesses, agencies and startups.", icon: "◇" }
];

function Professions() {
    return (
        <main className="discovery-page professions-page">
            <header className="discovery-header">
                <Link className="brand-mark" to="/" aria-label="Portfolio Generator home"><span className="brand-icon" aria-hidden="true">P</span><span>Portfolio<span className="brand-light"> Generator</span></span></Link>
                <nav className="discovery-nav" aria-label="Main navigation"><Link to="/templates">Templates</Link><Link className="nav-cta" to="/">Home</Link></nav>
            </header>
            <section className="discovery-shell discovery-page-intro">
                <Link className="back-link" to="/">← Back to home</Link>
                <p className="eyebrow">Start with your story</p>
                <h1>What kind of work do you do?</h1>
                <p className="page-intro-copy">Choose a profession to find a starting point made for the work you want to share.</p>
            </section>
            <section className="discovery-shell profession-grid profession-grid-all" aria-label="Choose a profession">
                {professions.map((profession, index) => (
                    <Link
                        className="profession-card"
                        key={profession.id}
                        to={`/templates?profession=${profession.id}`}
                        style={{ "--card-index": index }}
                    >
                        <span className="profession-icon" aria-hidden="true">{profession.icon}</span>
                        <span className="profession-card-title">{profession.name}<span aria-hidden="true">↗</span></span>
                        <span className="profession-card-description">{profession.description}</span>
                    </Link>
                ))}
            </section>
            <footer className="discovery-footer"><Link className="brand-mark" to="/"><span className="brand-icon" aria-hidden="true">P</span><span>Portfolio<span className="brand-light"> Generator</span></span></Link><p>Make your work easy to discover.</p><Link to="/templates">Browse all templates →</Link></footer>
        </main>
    );
}

export default Professions;
