import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import api from "../services/api";

function Templates() {

    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [searchParams] = useSearchParams();

    const profession = searchParams.get("profession");

    useEffect(() => {

        const fetchTemplates = async () => {

            try {

                const response = await api.get("/templates");

                let availableTemplates =
                    response.data.templates;

                if (profession) {

                    availableTemplates =
                        availableTemplates.filter(
                            (template) =>
                                template.category === profession
                        );

                }

                setTemplates(availableTemplates);

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
                    ? `${profession} Templates`
                    : "Choose Your Template"}
            </h1>

            {templates.length === 0 ? (

                <p>
                    No templates available for this profession yet.
                </p>

            ) : (

                <div>

                    {templates.map((template) => (

                        <div key={template._id}>

                            <h2>
                                {template.name}
                            </h2>

                            <p>
                                {template.description}
                            </p>

                            <p>
                                Category: {template.category}
                            </p>

                            <Link
                                to={`/templates/${template._id}`}
                            >
                                Preview
                            </Link>

                        </div>

                    ))}

                </div>
            )}

        </div>
    );
}

export default Templates;