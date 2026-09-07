import { Link } from "react-router-dom";

function Home() {
    return (
        <div>

            <nav>
                <h2>Portfolio Generator</h2>

                <Link to="/templates">
                    Templates
                </Link>
            </nav>

            <main>

                <h1>
                    Build Your Professional Portfolio
                </h1>

                <p>
                    Choose a template, add your information,
                    and generate your own HTML, CSS and JavaScript
                    portfolio.
                </p>

                <Link to="/professions">
    Explore Templates
</Link>

            </main>

        </div>
    );
}

export default Home;