import { useEffect, useState } from "react";
import {
    useNavigate,
    useParams,
    useSearchParams
} from "react-router-dom";

import api from "../services/api";

function Builder() {

    const navigate = useNavigate();

    const { id } = useParams();

    const [searchParams] = useSearchParams();

    const templateFromUrl = searchParams.get("template");

    const isEditMode = Boolean(id);


    // --------------------------------------------------
    // Template
    // --------------------------------------------------

    const [selectedTemplateId, setSelectedTemplateId] =
        useState(templateFromUrl);


    // --------------------------------------------------
    // Loading / Error
    // --------------------------------------------------

    const [loading, setLoading] = useState(false);

    const [error, setError] = useState("");


    // --------------------------------------------------
    // File Upload State
    // --------------------------------------------------

    const [profileImageFile, setProfileImageFile] =
        useState(null);

    const [resumeFile, setResumeFile] =
        useState(null);

    const [uploadingFiles, setUploadingFiles] =
        useState(false);


    // --------------------------------------------------
    // Form Data
    // --------------------------------------------------

    const [formData, setFormData] = useState({

        personal: {
            name: "",
            title: "",
            email: "",
            phone: "",
            location: "",
            profileImage: ""
        },

        shortIntro: "",

        about: "",

        skills: [],

        education: [
            {
                degree: "",
                institution: "",
                startYear: "",
                endYear: "",
                description: ""
            }
        ],

        experience: [
            {
                company: "",
                role: "",
                startDate: "",
                endDate: "",
                description: ""
            }
        ],

        projects: [
            {
                title: "",
                description: "",
                technologies: [],
                liveUrl: "",
                githubUrl: ""
            }
        ],

        social: {
            github: "",
            linkedin: "",
            twitter: ""
        }
    });


    // --------------------------------------------------
    // Temporary Inputs
    // --------------------------------------------------

    const [skillsInput, setSkillsInput] =
        useState("");

    const [technologyInputs, setTechnologyInputs] =
        useState({});


    // ==================================================
    // LOAD EXISTING PORTFOLIO
    // ==================================================

    useEffect(() => {

        if (!isEditMode) {
            return;
        }

        const fetchPortfolio = async () => {

            try {

                setLoading(true);

                const response = await api.get(
                    `/portfolios/${id}`
                );

                const portfolio =
                    response.data.portfolio;

                setSelectedTemplateId(
                    portfolio.template?._id ||
                    portfolio.template
                );


                setFormData({

                    personal: {

                        name:
                            portfolio.personal?.name ||
                            "",

                        title:
                            portfolio.personal?.title ||
                            "",

                        email:
                            portfolio.personal?.email ||
                            "",

                        phone:
                            portfolio.personal?.phone ||
                            "",

                        location:
                            portfolio.personal?.location ||
                            "",

                        profileImage:
                            portfolio.personal?.profileImage ||
                            ""
                    },


                    shortIntro:
                        portfolio.shortIntro ||
                        "",


                    about:
                        portfolio.about ||
                        "",


                    skills:
                        portfolio.skills ||
                        [],


                    education:
                        portfolio.education?.length
                            ? portfolio.education
                            : [
                                {
                                    degree: "",
                                    institution: "",
                                    startYear: "",
                                    endYear: "",
                                    description: ""
                                }
                            ],


                    experience:
                        portfolio.experience?.length
                            ? portfolio.experience
                            : [
                                {
                                    company: "",
                                    role: "",
                                    startDate: "",
                                    endDate: "",
                                    description: ""
                                }
                            ],


                    projects:
                        portfolio.projects?.length
                            ? portfolio.projects
                            : [
                                {
                                    title: "",
                                    description: "",
                                    technologies: [],
                                    liveUrl: "",
                                    githubUrl: ""
                                }
                            ],


                    social: {

                        github:
                            portfolio.social?.github ||
                            "",

                        linkedin:
                            portfolio.social?.linkedin ||
                            "",

                        twitter:
                            portfolio.social?.twitter ||
                            ""
                    }
                });

            } catch (error) {

                console.error(error);

                setError(
                    error.response?.data?.message ||
                    "Failed to load portfolio"
                );

            } finally {

                setLoading(false);
            }
        };

        fetchPortfolio();

    }, [id, isEditMode]);


    // ==================================================
    // PERSONAL INFORMATION
    // ==================================================

    const handlePersonalChange = (event) => {

        const { name, value } = event.target;

        setFormData((previous) => ({

            ...previous,

            personal: {

                ...previous.personal,

                [name]: value
            }
        }));
    };


    // ==================================================
    // INTRODUCTION
    // ==================================================

    const handleBasicChange = (event) => {

        const { name, value } = event.target;

        setFormData((previous) => ({

            ...previous,

            [name]: value
        }));
    };


    // ==================================================
    // SOCIAL LINKS
    // ==================================================

    const handleSocialChange = (event) => {

        const { name, value } = event.target;

        setFormData((previous) => ({

            ...previous,

            social: {

                ...previous.social,

                [name]: value
            }
        }));
    };


    // ==================================================
    // PROFILE IMAGE
    // ==================================================

    const handleProfileImageChange = (event) => {

        const file = event.target.files[0];

        if (!file) {
            return;
        }


        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];


        if (!allowedTypes.includes(file.type)) {

            setError(
                "Please select a JPG, PNG, or WEBP image."
            );

            event.target.value = "";

            return;
        }


        if (file.size > 5 * 1024 * 1024) {

            setError(
                "Profile image must be smaller than 5 MB."
            );

            event.target.value = "";

            return;
        }


        setError("");

        setProfileImageFile(file);
    };


    // ==================================================
    // RESUME
    // ==================================================

    const handleResumeChange = (event) => {

        const file = event.target.files[0];

        if (!file) {
            return;
        }


        if (file.type !== "application/pdf") {

            setError(
                "Resume must be a PDF file."
            );

            event.target.value = "";

            return;
        }


        if (file.size > 5 * 1024 * 1024) {

            setError(
                "Resume must be smaller than 5 MB."
            );

            event.target.value = "";

            return;
        }


        setError("");

        setResumeFile(file);
    };


    // ==================================================
    // SKILLS
    // ==================================================

    const addSkill = () => {

        const skill =
            skillsInput.trim();

        if (!skill) {
            return;
        }


        setFormData((previous) => ({

            ...previous,

            skills: [

                ...previous.skills,

                skill
            ]
        }));


        setSkillsInput("");
    };


    const removeSkill = (indexToRemove) => {

        setFormData((previous) => ({

            ...previous,

            skills:
                previous.skills.filter(
                    (_, index) =>
                        index !== indexToRemove
                )
        }));
    };


    // ==================================================
    // EDUCATION
    // ==================================================

    const handleEducationChange = (
        index,
        event
    ) => {

        const { name, value } =
            event.target;


        setFormData((previous) => {

            const updatedEducation =
                [...previous.education];


            updatedEducation[index] = {

                ...updatedEducation[index],

                [name]: value
            };


            return {

                ...previous,

                education:
                    updatedEducation
            };
        });
    };


    const addEducation = () => {

        setFormData((previous) => ({

            ...previous,

            education: [

                ...previous.education,

                {
                    degree: "",
                    institution: "",
                    startYear: "",
                    endYear: "",
                    description: ""
                }
            ]
        }));
    };


    const removeEducation = (
        indexToRemove
    ) => {

        setFormData((previous) => {

            const updatedEducation =
                previous.education.filter(
                    (_, index) =>
                        index !== indexToRemove
                );


            return {

                ...previous,

                education:
                    updatedEducation.length > 0
                        ? updatedEducation
                        : [
                            {
                                degree: "",
                                institution: "",
                                startYear: "",
                                endYear: "",
                                description: ""
                            }
                        ]
            };
        });
    };


    // ==================================================
    // EXPERIENCE
    // ==================================================

    const handleExperienceChange = (
        index,
        event
    ) => {

        const { name, value } =
            event.target;


        setFormData((previous) => {

            const updatedExperience =
                [...previous.experience];


            updatedExperience[index] = {

                ...updatedExperience[index],

                [name]: value
            };


            return {

                ...previous,

                experience:
                    updatedExperience
            };
        });
    };


    const addExperience = () => {

        setFormData((previous) => ({

            ...previous,

            experience: [

                ...previous.experience,

                {
                    company: "",
                    role: "",
                    startDate: "",
                    endDate: "",
                    description: ""
                }
            ]
        }));
    };


    const removeExperience = (
        indexToRemove
    ) => {

        setFormData((previous) => {

            const updatedExperience =
                previous.experience.filter(
                    (_, index) =>
                        index !== indexToRemove
                );


            return {

                ...previous,

                experience:
                    updatedExperience.length > 0
                        ? updatedExperience
                        : [
                            {
                                company: "",
                                role: "",
                                startDate: "",
                                endDate: "",
                                description: ""
                            }
                        ]
            };
        });
    };


    // ==================================================
    // PROJECTS
    // ==================================================

    const handleProjectChange = (
        index,
        event
    ) => {

        const { name, value } =
            event.target;


        setFormData((previous) => {

            const updatedProjects =
                [...previous.projects];


            updatedProjects[index] = {

                ...updatedProjects[index],

                [name]: value
            };


            return {

                ...previous,

                projects:
                    updatedProjects
            };
        });
    };


    const addProject = () => {

        setFormData((previous) => ({

            ...previous,

            projects: [

                ...previous.projects,

                {
                    title: "",
                    description: "",
                    technologies: [],
                    liveUrl: "",
                    githubUrl: ""
                }
            ]
        }));
    };


    const removeProject = (
        indexToRemove
    ) => {

        setFormData((previous) => {

            const updatedProjects =
                previous.projects.filter(
                    (_, index) =>
                        index !== indexToRemove
                );


            return {

                ...previous,

                projects:
                    updatedProjects.length > 0
                        ? updatedProjects
                        : [
                            {
                                title: "",
                                description: "",
                                technologies: [],
                                liveUrl: "",
                                githubUrl: ""
                            }
                        ]
            };
        });
    };


    // ==================================================
    // PROJECT TECHNOLOGIES
    // ==================================================

    const handleTechnologyInputChange = (
        projectIndex,
        value
    ) => {

        setTechnologyInputs((previous) => ({

            ...previous,

            [projectIndex]: value
        }));
    };


    const addTechnology = (
        projectIndex
    ) => {

        const technology =
            (
                technologyInputs[
                    projectIndex
                ] || ""
            ).trim();


        if (!technology) {
            return;
        }


        setFormData((previous) => {

            const updatedProjects =
                [...previous.projects];


            updatedProjects[projectIndex] = {

                ...updatedProjects[projectIndex],

                technologies: [

                    ...updatedProjects[
                        projectIndex
                    ].technologies,

                    technology
                ]
            };


            return {

                ...previous,

                projects:
                    updatedProjects
            };
        });


        setTechnologyInputs((previous) => ({

            ...previous,

            [projectIndex]: ""
        }));
    };


    const removeTechnology = (
        projectIndex,
        technologyIndex
    ) => {

        setFormData((previous) => {

            const updatedProjects =
                [...previous.projects];


            updatedProjects[projectIndex] = {

                ...updatedProjects[projectIndex],

                technologies:
                    updatedProjects[
                        projectIndex
                    ].technologies.filter(
                        (_, index) =>
                            index !== technologyIndex
                    )
            };


            return {

                ...previous,

                projects:
                    updatedProjects
            };
        });
    };


    // ==================================================
    // SUBMIT
    // ==================================================

    const handleSubmit = async (event) => {

        event.preventDefault();


        if (!selectedTemplateId) {

            setError(
                "No template selected."
            );

            return;
        }


        setError("");

        setLoading(true);


        try {

            const portfolioData = {

                ...formData,

                template:
                    selectedTemplateId
            };


            let response;


            // ------------------------------------------
            // Create / Update Portfolio
            // ------------------------------------------

            if (isEditMode) {

                response = await api.put(
                    `/portfolios/${id}`,
                    portfolioData
                );

            } else {

                response = await api.post(
                    "/portfolios",
                    portfolioData
                );
            }


            const savedPortfolio =
                response.data.portfolio;


            const portfolioId =
                savedPortfolio._id;


            console.log(
                isEditMode
                    ? "Portfolio updated:"
                    : "Portfolio created:",
                portfolioId
            );


            // ------------------------------------------
            // Upload Files
            // ------------------------------------------

            if (
                profileImageFile ||
                resumeFile
            ) {

                setUploadingFiles(true);


                const uploadData =
                    new FormData();


                if (profileImageFile) {

                    uploadData.append(
                        "profileImage",
                        profileImageFile
                    );
                }


                if (resumeFile) {

                    uploadData.append(
                        "resume",
                        resumeFile
                    );
                }


                await api.post(
                    `/uploads/${portfolioId}`,
                    uploadData,
                    {
                        headers: {
                            "Content-Type":
                                "multipart/form-data"
                        }
                    }
                );


                setUploadingFiles(false);
            }


            // ------------------------------------------
            // Finished
            // ------------------------------------------

            navigate("/dashboard");

        } catch (error) {

            console.error(error);


            setUploadingFiles(false);


            setError(
                error.response?.data?.message ||
                "Failed to save portfolio"
            );

        } finally {

            setLoading(false);
        }
    };


    // ==================================================
    // LOADING STATE
    // ==================================================

    if (
        isEditMode &&
        loading &&
        !formData.personal.name
    ) {

        return (
            <div>

                <h2>
                    Loading portfolio...
                </h2>

            </div>
        );
    }


    // ==================================================
    // UI
    // ==================================================

    return (

        <div>

            <h1>

                {isEditMode
                    ? "Edit Your Portfolio"
                    : "Create Your Portfolio"}

            </h1>


            <p>

                {isEditMode
                    ? "Update your portfolio information."
                    : "Add your information below."}

            </p>


            {error && (

                <p>

                    {error}

                </p>
            )}


            <form onSubmit={handleSubmit}>


                {/* =====================================
                    PERSONAL INFORMATION
                ====================================== */}

                <section>

                    <h2>
                        Personal Information
                    </h2>


                    <input
                        name="name"
                        placeholder="Full Name"
                        value={
                            formData.personal.name
                        }
                        onChange={
                            handlePersonalChange
                        }
                        required
                    />


                    <input
                        name="title"
                        placeholder="Professional Title"
                        value={
                            formData.personal.title
                        }
                        onChange={
                            handlePersonalChange
                        }
                        required
                    />


                    <input
                        name="email"
                        type="email"
                        placeholder="Email"
                        value={
                            formData.personal.email
                        }
                        onChange={
                            handlePersonalChange
                        }
                        required
                    />


                    <input
                        name="phone"
                        placeholder="Phone"
                        value={
                            formData.personal.phone
                        }
                        onChange={
                            handlePersonalChange
                        }
                    />


                    <input
                        name="location"
                        placeholder="Location"
                        value={
                            formData.personal.location
                        }
                        onChange={
                            handlePersonalChange
                        }
                    />


                    <input
                        name="profileImage"
                        placeholder="Profile Image URL"
                        value={
                            formData.personal.profileImage
                        }
                        onChange={
                            handlePersonalChange
                        }
                    />

                </section>


                {/* =====================================
                    FILE UPLOADS
                ====================================== */}

                <section>

                    <h2>
                        Profile Image & Resume
                    </h2>


                    {/* Profile Image */}

                    <div>

                        <label>
                            Profile Image
                        </label>

                        <br />

                        <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={
                                handleProfileImageChange
                            }
                        />


                        {profileImageFile && (

                            <p>

                                Selected:
                                {" "}
                                {profileImageFile.name}

                            </p>
                        )}

                    </div>


                    <br />


                    {/* Resume */}

                    <div>

                        <label>
                            Resume PDF
                        </label>

                        <br />

                        <input
                            type="file"
                            accept="application/pdf"
                            onChange={
                                handleResumeChange
                            }
                        />


                        {resumeFile && (

                            <p>

                                Selected:
                                {" "}
                                {resumeFile.name}

                            </p>
                        )}

                    </div>


                    <p>
                        Maximum file size: 5 MB
                    </p>

                </section>


                {/* =====================================
                    INTRODUCTION
                ====================================== */}

                <section>

                    <h2>
                        Introduction
                    </h2>


                    <textarea
                        name="shortIntro"
                        placeholder="Short introduction"
                        value={
                            formData.shortIntro
                        }
                        onChange={
                            handleBasicChange
                        }
                    />


                    <textarea
                        name="about"
                        placeholder="About You"
                        value={
                            formData.about
                        }
                        onChange={
                            handleBasicChange
                        }
                    />

                </section>


                {/* =====================================
                    SKILLS
                ====================================== */}

                <section>

                    <h2>
                        Skills
                    </h2>


                    <input
                        placeholder="Enter a skill"
                        value={skillsInput}
                        onChange={(event) =>
                            setSkillsInput(
                                event.target.value
                            )
                        }
                    />


                    <button
                        type="button"
                        onClick={addSkill}
                    >
                        Add Skill
                    </button>


                    <div>

                        {formData.skills.map(
                            (skill, index) => (

                                <div key={index}>

                                    <span>
                                        {skill}
                                    </span>


                                    <button
                                        type="button"
                                        onClick={() =>
                                            removeSkill(
                                                index
                                            )
                                        }
                                    >
                                        Remove
                                    </button>

                                </div>
                            )
                        )}

                    </div>

                </section>


                {/* =====================================
                    EDUCATION
                ====================================== */}

                <section>

                    <h2>
                        Education
                    </h2>


                    {formData.education.map(
                        (education, index) => (

                            <div key={index}>

                                <h3>
                                    Education {index + 1}
                                </h3>


                                <input
                                    name="degree"
                                    placeholder="Degree"
                                    value={
                                        education.degree
                                    }
                                    onChange={(event) =>
                                        handleEducationChange(
                                            index,
                                            event
                                        )
                                    }
                                />


                                <input
                                    name="institution"
                                    placeholder="Institution"
                                    value={
                                        education.institution
                                    }
                                    onChange={(event) =>
                                        handleEducationChange(
                                            index,
                                            event
                                        )
                                    }
                                />


                                <input
                                    name="startYear"
                                    placeholder="Start Year"
                                    value={
                                        education.startYear
                                    }
                                    onChange={(event) =>
                                        handleEducationChange(
                                            index,
                                            event
                                        )
                                    }
                                />


                                <input
                                    name="endYear"
                                    placeholder="End Year"
                                    value={
                                        education.endYear
                                    }
                                    onChange={(event) =>
                                        handleEducationChange(
                                            index,
                                            event
                                        )
                                    }
                                />


                                <textarea
                                    name="description"
                                    placeholder="Education description"
                                    value={
                                        education.description
                                    }
                                    onChange={(event) =>
                                        handleEducationChange(
                                            index,
                                            event
                                        )
                                    }
                                />


                                <button
                                    type="button"
                                    onClick={() =>
                                        removeEducation(
                                            index
                                        )
                                    }
                                >
                                    Remove Education
                                </button>

                            </div>
                        )
                    )}


                    <button
                        type="button"
                        onClick={addEducation}
                    >
                        + Add Education
                    </button>

                </section>


                {/* =====================================
                    EXPERIENCE
                ====================================== */}

                <section>

                    <h2>
                        Experience
                    </h2>


                    {formData.experience.map(
                        (experience, index) => (

                            <div key={index}>

                                <h3>
                                    Experience {index + 1}
                                </h3>


                                <input
                                    name="company"
                                    placeholder="Company"
                                    value={
                                        experience.company
                                    }
                                    onChange={(event) =>
                                        handleExperienceChange(
                                            index,
                                            event
                                        )
                                    }
                                />


                                <input
                                    name="role"
                                    placeholder="Role"
                                    value={
                                        experience.role
                                    }
                                    onChange={(event) =>
                                        handleExperienceChange(
                                            index,
                                            event
                                        )
                                    }
                                />


                                <input
                                    name="startDate"
                                    placeholder="Start Date"
                                    value={
                                        experience.startDate
                                    }
                                    onChange={(event) =>
                                        handleExperienceChange(
                                            index,
                                            event
                                        )
                                    }
                                />


                                <input
                                    name="endDate"
                                    placeholder="End Date"
                                    value={
                                        experience.endDate
                                    }
                                    onChange={(event) =>
                                        handleExperienceChange(
                                            index,
                                            event
                                        )
                                    }
                                />


                                <textarea
                                    name="description"
                                    placeholder="Experience description"
                                    value={
                                        experience.description
                                    }
                                    onChange={(event) =>
                                        handleExperienceChange(
                                            index,
                                            event
                                        )
                                    }
                                />


                                <button
                                    type="button"
                                    onClick={() =>
                                        removeExperience(
                                            index
                                        )
                                    }
                                >
                                    Remove Experience
                                </button>

                            </div>
                        )
                    )}


                    <button
                        type="button"
                        onClick={addExperience}
                    >
                        + Add Experience
                    </button>

                </section>


                {/* =====================================
                    PROJECTS
                ====================================== */}

                <section>

                    <h2>
                        Projects
                    </h2>


                    {formData.projects.map(
                        (project, projectIndex) => (

                            <div
                                key={projectIndex}
                            >

                                <h3>
                                    Project{" "}
                                    {projectIndex + 1}
                                </h3>


                                <input
                                    name="title"
                                    placeholder="Project Title"
                                    value={
                                        project.title
                                    }
                                    onChange={(event) =>
                                        handleProjectChange(
                                            projectIndex,
                                            event
                                        )
                                    }
                                />


                                <textarea
                                    name="description"
                                    placeholder="Project Description"
                                    value={
                                        project.description
                                    }
                                    onChange={(event) =>
                                        handleProjectChange(
                                            projectIndex,
                                            event
                                        )
                                    }
                                />


                                {/* Technologies */}

                                <h4>
                                    Technologies
                                </h4>


                                <input
                                    placeholder="Technology"
                                    value={
                                        technologyInputs[
                                            projectIndex
                                        ] || ""
                                    }
                                    onChange={(event) =>
                                        handleTechnologyInputChange(
                                            projectIndex,
                                            event.target.value
                                        )
                                    }
                                />


                                <button
                                    type="button"
                                    onClick={() =>
                                        addTechnology(
                                            projectIndex
                                        )
                                    }
                                >
                                    Add Technology
                                </button>


                                <div>

                                    {project.technologies.map(
                                        (
                                            technology,
                                            technologyIndex
                                        ) => (

                                            <div
                                                key={
                                                    technologyIndex
                                                }
                                            >

                                                <span>
                                                    {technology}
                                                </span>


                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        removeTechnology(
                                                            projectIndex,
                                                            technologyIndex
                                                        )
                                                    }
                                                >
                                                    Remove
                                                </button>

                                            </div>
                                        )
                                    )}

                                </div>


                                <input
                                    name="liveUrl"
                                    placeholder="Live Project URL"
                                    value={
                                        project.liveUrl
                                    }
                                    onChange={(event) =>
                                        handleProjectChange(
                                            projectIndex,
                                            event
                                        )
                                    }
                                />


                                <input
                                    name="githubUrl"
                                    placeholder="GitHub URL"
                                    value={
                                        project.githubUrl
                                    }
                                    onChange={(event) =>
                                        handleProjectChange(
                                            projectIndex,
                                            event
                                        )
                                    }
                                />


                                <button
                                    type="button"
                                    onClick={() =>
                                        removeProject(
                                            projectIndex
                                        )
                                    }
                                >
                                    Remove Project
                                </button>

                            </div>
                        )
                    )}


                    <button
                        type="button"
                        onClick={addProject}
                    >
                        + Add Project
                    </button>

                </section>


                {/* =====================================
                    SOCIAL LINKS
                ====================================== */}

                <section>

                    <h2>
                        Social Links
                    </h2>


                    <input
                        name="github"
                        placeholder="GitHub"
                        value={
                            formData.social.github
                        }
                        onChange={
                            handleSocialChange
                        }
                    />


                    <input
                        name="linkedin"
                        placeholder="LinkedIn"
                        value={
                            formData.social.linkedin
                        }
                        onChange={
                            handleSocialChange
                        }
                    />


                    <input
                        name="twitter"
                        placeholder="Twitter"
                        value={
                            formData.social.twitter
                        }
                        onChange={
                            handleSocialChange
                        }
                    />

                </section>


                {/* =====================================
                    SUBMIT
                ====================================== */}

                <button
                    type="submit"
                    disabled={
                        loading ||
                        uploadingFiles
                    }
                >

                    {uploadingFiles
                        ? "Uploading Files..."
                        : loading
                            ? "Saving..."
                            : isEditMode
                                ? "Update Portfolio"
                                : "Create Portfolio"}

                </button>


            </form>

        </div>
    );
}

export default Builder;