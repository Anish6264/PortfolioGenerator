import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import "./PublicPortfolio.css";

function PublicPortfolio() {
    const { slug } = useParams();
    const [portfolio, setPortfolio] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        api.get(`/public/portfolios/${encodeURIComponent(slug)}`)
            .then(({ data }) => { if (active) setPortfolio(data); })
            .catch((requestError) => {
                if (active) setError(requestError.response?.status === 404
                    ? "This portfolio is unavailable."
                    : requestError.response?.data?.message || "Unable to load this portfolio.");
            })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [slug]);

    useEffect(() => {
        if (!portfolio) return undefined;
        const oldTitle = document.title;
        const metaValues = [
            ["name", "description", portfolio.description || ""],
            ["property", "og:title", portfolio.title || "Portfolio"],
            ["property", "og:description", portfolio.description || ""],
            ["property", "og:type", "website"],
            [
                "property",
                "og:image",
                portfolio.hasProfileImage
                    ? `${api.defaults.baseURL}/public/portfolios/${encodeURIComponent(slug)}/profile-image`
                    : ""
            ]
        ];
        const previousMeta = metaValues.map(([attribute, key, content]) => {
            const selector = `meta[${attribute}="${key}"]`;
            const meta = document.querySelector(selector);
            const previous = meta?.content;
            if (meta) meta.content = content;
            else {
                const created = document.createElement("meta");
                created.setAttribute(attribute, key);
                created.content = content;
                document.head.appendChild(created);
            }
            return { selector, previous };
        });
        document.title = portfolio.title || "Portfolio";
        return () => {
            document.title = oldTitle;
            for (const { selector, previous } of previousMeta) {
                const meta = document.querySelector(selector);
                if (!meta) continue;
                if (previous === undefined) meta.remove();
                else meta.content = previous;
            }
        };
    }, [portfolio, slug]);

    if (loading) return <main className="public-portfolio-state"><span className="public-portfolio-loader" aria-hidden="true" /><p role="status" aria-busy="true">Loading portfolio…</p></main>;
    if (error || !portfolio) return <main className="public-portfolio-state public-portfolio-unavailable"><span aria-hidden="true">!</span><p className="public-portfolio-eyebrow">Portfolio Generator</p><h1>Portfolio unavailable</h1><p role="alert">{error || "This portfolio is unavailable."}</p></main>;

    const publicBase = `${api.defaults.baseURL}/public/portfolios/${encodeURIComponent(slug)}`;
    const html = portfolio.html
        .replace(/assets\/profile-image\.(?:jpe?g|png|webp)/gi, `${publicBase}/profile-image`)
        .replaceAll("assets/resume.pdf", `${publicBase}/resume`)
        .replaceAll(
            `href="/api/public/portfolios/${encodeURIComponent(slug)}/project/`,
            `href="${publicBase}/project/`
        );

    return (
        <main className="public-portfolio-shell">
            <iframe
                className="public-portfolio-frame"
                title={portfolio.title || "Portfolio"}
                srcDoc={html}
                sandbox="allow-scripts allow-popups"
                style={{ display: "block", width: "100%", minHeight: "100vh", border: 0 }}
            />
        </main>
    );
}

export default PublicPortfolio;
