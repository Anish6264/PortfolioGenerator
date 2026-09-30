import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../services/api";
import { useAuth } from "../hooks/useAuth";

function Dashboard() {

    const navigate = useNavigate();

    const {
        user,
        logout,
        refreshUser
    } = useAuth();

    const [portfolios, setPortfolios] = useState([]);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState("");

    const [generatingId, setGeneratingId] =
        useState(null);

    const [searchTerm, setSearchTerm] = useState("");

    const [statusFilter, setStatusFilter] = useState("all");

    const [templateFilter, setTemplateFilter] = useState("all");

    const [updatingId, setUpdatingId] = useState(null);

    const templateNames = Array.from(new Set(
        portfolios
            .map((portfolio) => portfolio.template?.name)
            .filter(Boolean)
    ));

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filteredPortfolios = portfolios.filter((portfolio) => {
        const matchesSearch = !normalizedSearch || [
            portfolio.personal?.name,
            portfolio.personal?.title
        ].some((value) => value?.toLowerCase().includes(normalizedSearch));
        const matchesStatus = statusFilter === "all" ||
            (portfolio.status || "draft") === statusFilter;
        const matchesTemplate = templateFilter === "all" ||
            portfolio.template?.name === templateFilter;

        return matchesSearch && matchesStatus && matchesTemplate;
    });


    // --------------------------------------------------
    // Fetch user's portfolios
    // --------------------------------------------------

    useEffect(() => {

        const fetchPortfolios = async () => {

            try {

                const response = await api.get(
                    "/portfolios"
                );

                setPortfolios(
                    response.data.portfolios
                );

            } catch (error) {

                console.error(error);

                setError(
                    error.response?.data?.message ||
                    "Failed to load portfolios"
                );

            } finally {

                setLoading(false);
            }
        };

        fetchPortfolios();

    }, []);


    // --------------------------------------------------
    // Delete portfolio
    // --------------------------------------------------

    const handleDelete = async (portfolioId) => {

        const confirmed = window.confirm(
            "Are you sure you want to delete this portfolio?"
        );

        if (!confirmed) {
            return;
        }

        try {

            setError("");

            await api.delete(
                `/portfolios/${portfolioId}`
            );

            setPortfolios((previous) =>
                previous.filter(
                    (portfolio) =>
                        portfolio._id !== portfolioId
                )
            );

        } catch (error) {

            console.error(error);

            setError(
                error.response?.data?.message ||
                "Failed to delete portfolio"
            );
        }
    };

    const handleDuplicate = async (portfolioId) => {
        try {
            setError("");
            const response = await api.post(
                `/portfolios/${portfolioId}/duplicate`
            );
            setPortfolios((previous) => [
                response.data.portfolio,
                ...previous
            ]);
        } catch (error) {
            console.error(error);
            setError(
                error.response?.data?.message ||
                "Failed to duplicate portfolio"
            );
        }
    };

    const handleStatusChange = async (portfolio) => {
        const nextStatus = portfolio.status === "published"
            ? "draft"
            : "published";

        try {
            setUpdatingId(portfolio._id);
            setError("");
            const response = await api.patch(
                `/portfolios/${portfolio._id}/status`,
                { status: nextStatus }
            );
            setPortfolios((previous) => previous.map((item) =>
                item._id === portfolio._id
                    ? response.data.portfolio
                    : item
            ));
        } catch (error) {
            console.error(error);
            setError(
                error.response?.data?.message ||
                "Failed to update portfolio status"
            );
        } finally {
            setUpdatingId(null);
        }
    };


    // --------------------------------------------------
    // Generate and download portfolio
    // --------------------------------------------------

    const handleGenerate = async (portfolioId) => {

        try {

            setGeneratingId(portfolioId);

            setError("");

            const response = await api.post(
                `/generator/${portfolioId}`,
                {},
                {
                    responseType: "blob"
                }
            );

            const blob = new Blob(
                [response.data],
                {
                    type: "application/zip"
                }
            );

            const url =
                window.URL.createObjectURL(blob);

            const link =
                document.createElement("a");

            link.href = url;

            link.download = "my-portfolio.zip";

            document.body.appendChild(link);

            link.click();

            link.remove();

            window.URL.revokeObjectURL(url);

            try {
                await refreshUser();
            } catch (refreshError) {
                console.error("Failed to refresh user data:", refreshError);
            }

        } catch (error) {

            console.error(error);

            setError(
                error.response?.status === 402
                    ? "Insufficient credits"
                    : "Failed to generate portfolio"
            );

        } finally {

            setGeneratingId(null);
        }
    };


    // --------------------------------------------------
    // Logout
    // --------------------------------------------------

    const handleLogout = () => {

        logout();

        navigate("/login");
    };


    // --------------------------------------------------
    // Loading
    // --------------------------------------------------

    if (loading) {

        return (
            <div>
                <h2>
                    Loading dashboard...
                </h2>
            </div>
        );
    }


    // --------------------------------------------------
    // Dashboard
    // --------------------------------------------------

    return (
        <div>

            {/* Header */}

            <header>

                <div>

                    <h1>
                        Welcome, {user?.name}
                    </h1>

                    <p>
                        Manage your portfolios
                    </p>

                    <p>
                        Credits: {user?.credits ?? 0}
                    </p>

                </div>


                <div>

                    <Link to="/professions">
                        + Create Portfolio
                    </Link>

                    {" "}

                    <button
                        onClick={handleLogout}
                    >
                        Logout
                    </button>

                </div>

            </header>


            {/* Main */}

            <main>

                <h2>
                    My Portfolios
                </h2>

                <div>
                    <label>
                        Search by name or title{" "}
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                    </label>

                    <label>
                        Status{" "}
                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                        >
                            <option value="all">All</option>
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                        </select>
                    </label>

                    {templateNames.length > 0 && (
                        <label>
                            Template{" "}
                            <select
                                value={templateFilter}
                                onChange={(event) => setTemplateFilter(event.target.value)}
                            >
                                <option value="all">All templates</option>
                                {templateNames.map((name) => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </label>
                    )}
                </div>


                {error && (
                    <p>{error}</p>
                )}


                {portfolios.length === 0 ? (

                    <div>

                        <p>
                            You haven't created any
                            portfolios yet.
                        </p>

                        <Link to="/professions">
                            Create Your First Portfolio
                        </Link>

                    </div>

                ) : (

                    <div>

                        {filteredPortfolios.map(
                            (portfolio) => (

                                <article
                                    key={
                                        portfolio._id
                                    }
                                >

                                    <h3>
                                        {
                                            portfolio
                                                .personal
                                                ?.name
                                        }
                                    </h3>

                                    <p>
                                        {
                                            portfolio
                                                .personal
                                                ?.title
                                        }
                                    </p>

                                    <p>
                                        Template:{" "}

                                        {
                                            portfolio
                                                .template
                                                ?.name ||
                                            "Unknown Template"
                                        }
                                    </p>

                                    <p>Status: {portfolio.status || "draft"}</p>


                                    <div>

                                        {/* Edit */}

                                        <Link
                                            to={`/builder/edit/${portfolio._id}`}
                                        >
                                            Edit
                                        </Link>

                                        {" "}

                                        <button
                                            type="button"
                                            onClick={() => handleDuplicate(portfolio._id)}
                                        >
                                            Duplicate
                                        </button>

                                        {" "}

                                        <button
                                            type="button"
                                            onClick={() => handleStatusChange(portfolio)}
                                            disabled={updatingId === portfolio._id}
                                        >
                                            {updatingId === portfolio._id
                                                ? "Updating..."
                                                : portfolio.status === "published"
                                                    ? "Unpublish"
                                                    : "Publish"}
                                        </button>

                                        {" "}

<Link
    to={`/portfolio-preview/${portfolio._id}`}
>
    Preview
</Link>


                                        {" "}


                                        {/* Generate */}

                                        <button
                                            onClick={() =>
                                                handleGenerate(
                                                    portfolio._id
                                                )
                                            }
                                            disabled={
                                                generatingId ===
                                                portfolio._id
                                            }
                                        >
                                            {
                                                generatingId ===
                                                portfolio._id
                                                    ? "Generating..."
                                                    : "Download Portfolio"
                                            }
                                        </button>


                                        {" "}


                                        {/* Delete */}

                                        <button
                                            onClick={() =>
                                                handleDelete(
                                                    portfolio._id
                                                )
                                            }
                                        >
                                            Delete
                                        </button>

                                    </div>

                                </article>
                            )
                        )}

                        {filteredPortfolios.length === 0 && (
                            <p>No portfolios match these filters.</p>
                        )}

                    </div>
                )}

            </main>

        </div>
    );
}

export default Dashboard;
