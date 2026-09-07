import { Link } from "react-router-dom";

const professions = [
    {
        id: "developer",
        name: "Software Developer",
        description: "For software and full-stack developers."
    },
    {
        id: "ml-engineer",
        name: "ML Engineer",
        description: "For machine learning and AI professionals."
    },
    {
        id: "data-scientist",
        name: "Data Scientist",
        description: "For data science and analytics professionals."
    },
    {
        id: "web-developer",
        name: "Web Developer",
        description: "For frontend and web developers."
    },
    {
        id: "devops",
        name: "DevOps Engineer",
        description: "For cloud and DevOps professionals."
    },
    {
        id: "cybersecurity",
        name: "Cybersecurity",
        description: "For security professionals."
    },
    {
        id: "ui-ux",
        name: "UI/UX Designer",
        description: "For designers and creative professionals."
    },
    {
        id: "product-manager",
        name: "Product Manager",
        description: "For product and business professionals."
    },
    {
        id: "company",
        name: "Company / Business",
        description: "For businesses, agencies and startups."
    }
];

function Professions() {
    return (
        <div>

            <h1>Choose Your Profession</h1>

            <p>
                Select your profession to find templates
                designed specifically for your career.
            </p>

            <div>

                {professions.map((profession) => (

                    <Link
                        key={profession.id}
                        to={`/templates?profession=${profession.id}`}
                    >

                        <div>

                            <h2>
                                {profession.name}
                            </h2>

                            <p>
                                {profession.description}
                            </p>

                        </div>

                    </Link>

                ))}

            </div>

        </div>
    );
}

export default Professions;