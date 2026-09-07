import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../services/api";
import { useAuth } from "../hooks/useAuth";

function Dashboard() {

    const navigate = useNavigate();

    const {
        user,
        logout
    } = useAuth();

    const [portfolios, setPortfolios] = useState([]);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState("");

    const [generatingId, setGeneratingId] =
        useState(null);


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

        } catch (error) {

            console.error(error);

            setError(
                "Failed to generate portfolio"
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

                        {portfolios.map(
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


                                    <div>

                                        {/* Edit */}

                                        <Link
                                            to={`/builder/edit/${portfolio._id}`}
                                        >
                                            Edit
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

                    </div>
                )}

            </main>

        </div>
    );
}

export default Dashboard;