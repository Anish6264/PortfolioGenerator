import { useEffect, useRef, useState } from "react";
import {
    useNavigate,
    useParams,
    useSearchParams
} from "react-router-dom";

import api from "../services/api";
import ProposedChangesReview from "../components/ProposedChangesReview";
import { validateProposedPortfolioData } from "../utils/proposedPortfolioData";
import buildAIRequest from "../utils/aiContentContext";

const supportedSections = [
    "about",
    "education",
    "experience",
    "skills",
    "projects",
    "contact"
];

const defaultSectionVisibility = Object.fromEntries(
    supportedSections.map((section) => [section, true])
);

const supportedFonts = [
    "Arial",
    "Inter",
    "Poppins",
    "Roboto",
    "Open Sans",
    "Merriweather"
];

function Builder() {

    const navigate = useNavigate();

    const { id } = useParams();

    const [searchParams] = useSearchParams();

    const templateFromUrl = searchParams.get("template");

    const isEditMode = Boolean(id);


    // --------------------------------------------------
    // Template
    // --------------------------------------------------

    const [portfolioTemplateId, setPortfolioTemplateId] =
        useState(null);

    const [availableTemplates, setAvailableTemplates] =
        useState([]);

    const [showTemplateSelector, setShowTemplateSelector] =
        useState(false);

    const [loadingTemplates, setLoadingTemplates] =
        useState(false);

    const selectedTemplateId = isEditMode
        ? portfolioTemplateId
        : templateFromUrl;


    // --------------------------------------------------
    // Loading / Error
    // --------------------------------------------------

    const [loading, setLoading] = useState(false);

    const [error, setError] = useState("");
    const [autosaveStatus, setAutosaveStatus] = useState("Saved");
    const [portfolioLoaded, setPortfolioLoaded] = useState(false);
    const [savedSnapshotState, setSavedSnapshotState] = useState("");
    const autosaveTimer = useRef(null);
    const autosaveRequest = useRef(null);
    const lastSavedSnapshot = useRef("");
    const autosaveRevision = useRef(0);
    const saveInProgress = useRef(false);


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
        },

        primaryColor: "#111827",
        secondaryColor: "#6b7280",
        backgroundColor: "#ffffff",
        textColor: "#1f2937",
        fontFamily: "Arial",
        sectionVisibility: { ...defaultSectionVisibility },
        sectionOrder: [],
        customSections: [],
        seoTitle: "",
        seoDescription: ""
    });


    // --------------------------------------------------
    // Temporary Inputs
    // --------------------------------------------------

    const [skillsInput, setSkillsInput] =
        useState("");

    const [technologyInputs, setTechnologyInputs] =
        useState({});

    const [importBusy, setImportBusy] = useState("");
    const [importMessage, setImportMessage] = useState("");
    const [githubReference, setGithubReference] = useState("");
    const [reviewProposal, setReviewProposal] = useState(null);

    const pendingFiles = {
        ...(profileImageFile ? { profileImage: profileImageFile.name } : {}),
        ...(resumeFile ? { resume: resumeFile.name } : {})
    };
    const currentSnapshot = JSON.stringify({ ...formData, template: selectedTemplateId, ...(Object.keys(pendingFiles).length ? { pendingFiles } : {}) });
    const meaningfulData = Boolean(
        Object.values(formData.personal).some((value) => String(value || "").trim()) ||
        Object.values(formData.social).some((value) => String(value || "").trim()) ||
        formData.shortIntro.trim() || formData.about.trim() || formData.skills.length ||
        formData.education.some((item) => Object.values(item).some((value) => String(value || "").trim())) ||
        formData.experience.some((item) => Object.values(item).some((value) => String(value || "").trim())) ||
        formData.projects.some((item) => item.title.trim() || item.description.trim() || item.githubUrl.trim() || item.liveUrl.trim() || item.technologies.length) ||
        formData.customSections.some((item) => item.title.trim() || item.content.trim()) ||
        formData.seoTitle.trim() || formData.seoDescription.trim() || formData.sectionOrder.length > 0 ||
        Object.values(formData.sectionVisibility).some((visible) => !visible) ||
        formData.primaryColor !== "#111827" || formData.secondaryColor !== "#6b7280" ||
        formData.backgroundColor !== "#ffffff" || formData.textColor !== "#1f2937" || formData.fontFamily !== "Arial"
    );
    const hasUnsavedChanges = (portfolioLoaded || !isEditMode) && meaningfulData && currentSnapshot !== savedSnapshotState;

    useEffect(() => {
        const confirmInternalNavigation = (event) => {
            const anchor = event.target.closest?.("a[href]");
            if (!anchor || !hasUnsavedChanges || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.target === "_blank") return;
            const destination = new URL(anchor.href, window.location.href);
            if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return;
            event.preventDefault();
            event.stopPropagation();
            if (window.confirm("You have unsaved portfolio changes. Leave this page?")) {
                navigate(`${destination.pathname}${destination.search}${destination.hash}`);
            }
        };
        document.addEventListener("click", confirmInternalNavigation, true);
        return () => document.removeEventListener("click", confirmInternalNavigation, true);
    }, [hasUnsavedChanges, navigate]);

    useEffect(() => {
        if (!hasUnsavedChanges) return undefined;
        const warnBeforeUnload = (event) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", warnBeforeUnload);
        return () => window.removeEventListener("beforeunload", warnBeforeUnload);
    }, [hasUnsavedChanges]);

    const handleTemplateSelectorToggle = async () => {
        if (showTemplateSelector) {
            setShowTemplateSelector(false);
            return;
        }

        setShowTemplateSelector(true);
        setError("");

        if (availableTemplates.length > 0) {
            return;
        }

        try {
            setLoadingTemplates(true);
            const response = await api.get("/templates");
            setAvailableTemplates(response.data.templates);
        } catch (error) {
            console.error(error);
            setError("Failed to load templates");
        } finally {
            setLoadingTemplates(false);
        }
    };

    const showProposal = (source, data, replacements = {}) => {
        const validationError = validateProposedPortfolioData(data);
        if (validationError) {
            setImportMessage("The imported content was invalid and has not changed your portfolio.");
            return;
        }
        setReviewProposal({ source, data, replacements, id: Date.now() });
        setImportMessage("");
    };

    const handleResumeImport = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf") || file.size > 5 * 1024 * 1024) {
            setImportMessage("Choose a PDF resume that is 5 MB or smaller.");
            event.target.value = "";
            return;
        }

        const upload = new FormData();
        upload.append("resume", file);
        setImportBusy("resume");
        setImportMessage("");
        try {
            const response = await api.post("/import/resume", upload, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            if (response.data.proposedData) showProposal("resume", response.data.proposedData);
            else setImportMessage(response.data.message || "No resume data was imported.");
        } catch (requestError) {
            setImportMessage(requestError.response?.data?.message || "Resume import is currently unavailable.");
        } finally {
            setImportBusy("");
            event.target.value = "";
        }
    };

    const handleGitHubImport = async () => {
        setImportBusy("github");
        setImportMessage("");
        try {
            const response = await api.post("/import/github", { reference: githubReference });
            if (response.data.proposedData) showProposal("GitHub", response.data.proposedData);
            else if (Array.isArray(response.data.repositories) && response.data.repositories.length) {
                setReviewProposal({ source: "GitHub", data: {}, repositories: response.data.repositories, id: Date.now() });
            }
            else setImportMessage(response.data.message || "No GitHub data was imported.");
        } catch (requestError) {
            setImportMessage(requestError.response?.data?.message || "GitHub import is currently unavailable.");
        } finally {
            setImportBusy("");
        }
    };

    const handleAiContentRequest = async (type, input, context, target) => {
        setImportBusy(`ai-${target}`);
        setImportMessage("");
        try {
            const response = await api.post("/ai/content", buildAIRequest(type, input, context));
            const content = response.data.content ?? response.data.proposedText;
            if (typeof content !== "string") {
                setImportMessage(response.data.message || "No generated content was returned.");
                return;
            }

            const proposedText = content.trim();
            if (!proposedText || proposedText.length > (response.data.maxLength || 4000)) {
                setImportMessage("The generated content was invalid and has not changed your portfolio.");
                return;
            }
            if (type === "about" || type === "shortIntro") {
                showProposal("AI-assisted", { [type]: proposedText });
            } else if (type === "skills") {
                const skills = proposedText.split(/[\n,]+/).map((skill) => skill.trim()).filter(Boolean);
                showProposal("AI-assisted", { skills });
            } else {
                const [section, index] = target.split(".");
                showProposal("AI-assisted", {}, { [`${section}.${index}.description`]: proposedText });
            }
        } catch (requestError) {
            setImportMessage(requestError.response?.data?.message || "AI-assisted content is currently unavailable. Your data was not changed.");
        } finally {
            setImportBusy("");
        }
    };

    const applyProposal = (mergedData) => {
        setFormData(mergedData);
        setReviewProposal(null);
        setImportMessage("Selected changes were applied. Save or continue editing to keep them.");
    };


    // ==================================================
    // LOAD EXISTING PORTFOLIO
    // ==================================================

    useEffect(() => {

        if (!isEditMode) {
            return;
        }

        const fetchPortfolio = async () => {

            try {

                setPortfolioLoaded(false);
                setLoading(true);

                const response = await api.get(
                    `/portfolios/${id}`
                );

                const portfolio =
                    response.data.portfolio;

                setPortfolioTemplateId(
                    portfolio.template?._id ||
                    portfolio.template
                );


                const loadedFormData = {

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
                    },

                    primaryColor: portfolio.primaryColor || "#111827",
                    secondaryColor: portfolio.secondaryColor || "#6b7280",
                    backgroundColor: portfolio.backgroundColor || "#ffffff",
                    textColor: portfolio.textColor || "#1f2937",
                    fontFamily: supportedFonts.includes(portfolio.fontFamily)
                        ? portfolio.fontFamily
                        : "Arial",
                    sectionVisibility: {
                        ...defaultSectionVisibility,
                        ...(portfolio.sectionVisibility || {})
                    },
                    sectionOrder: Array.isArray(portfolio.sectionOrder)
                        ? portfolio.sectionOrder
                        : [],
                    customSections: Array.isArray(portfolio.customSections)
                        ? portfolio.customSections
                        : [],
                    seoTitle: portfolio.seoTitle || "",
                    seoDescription: portfolio.seoDescription || ""
                };

                setFormData(loadedFormData);
                const loadedSnapshot = JSON.stringify({
                    ...loadedFormData,
                    template: portfolio.template?._id || portfolio.template
                });
                lastSavedSnapshot.current = loadedSnapshot;
                setSavedSnapshotState(loadedSnapshot);
                setPortfolioLoaded(true);

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

    useEffect(() => {
        if (
            !isEditMode ||
            !portfolioLoaded ||
            loading ||
            uploadingFiles
        ) {
            return undefined;
        }

        const portfolioData = {
            ...formData,
            template: selectedTemplateId
        };
        const snapshot = JSON.stringify(portfolioData);

        if (snapshot === lastSavedSnapshot.current) {
            return undefined;
        }

        const revision = ++autosaveRevision.current;
        setAutosaveStatus("Saving...");
        autosaveTimer.current = setTimeout(() => {
            const request = (autosaveRequest.current || Promise.resolve())
                .catch(() => {})
                .then(() => api.put(`/portfolios/${id}`, portfolioData));
            autosaveRequest.current = request;

            request
                .then(() => {
                    if (revision === autosaveRevision.current) {
                        lastSavedSnapshot.current = snapshot;
                        setSavedSnapshotState(snapshot);
                        setAutosaveStatus("Saved");
                    }
                })
                .catch((autosaveError) => {
                    console.error("Portfolio autosave failed:", autosaveError);
                    if (revision === autosaveRevision.current) setAutosaveStatus("Autosave failed");
                })
                .finally(() => {
                    if (autosaveRequest.current === request) {
                        autosaveRequest.current = null;
                    }
                });
        }, 900);

        return () => clearTimeout(autosaveTimer.current);
    }, [
        formData,
        id,
        isEditMode,
        loading,
        portfolioLoaded,
        selectedTemplateId,
        uploadingFiles
    ]);


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

    const handleSectionVisibilityChange = (section, visible) => {
        setFormData((previous) => ({
            ...previous,
            sectionVisibility: {
                ...previous.sectionVisibility,
                [section]: visible
            }
        }));
    };

    const moveSection = (index, offset) => {
        setFormData((previous) => {
            const sectionOrder = previous.sectionOrder.length
                ? [...previous.sectionOrder]
                : [...supportedSections];
            const destination = index + offset;

            if (destination < 0 || destination >= sectionOrder.length) {
                return previous;
            }

            [sectionOrder[index], sectionOrder[destination]] =
                [sectionOrder[destination], sectionOrder[index]];

            return { ...previous, sectionOrder };
        });
    };

    const updateCustomSection = (index, field, value) => {
        setFormData((previous) => ({
            ...previous,
            customSections: previous.customSections.map((section, sectionIndex) =>
                sectionIndex === index
                    ? { ...section, [field]: value }
                    : section
            )
        }));
    };

    const addCustomSection = () => {
        setFormData((previous) => ({
            ...previous,
            customSections: [
                ...previous.customSections,
                { title: "", content: "" }
            ]
        }));
    };

    const removeCustomSection = (indexToRemove) => {
        setFormData((previous) => ({
            ...previous,
            customSections: previous.customSections.filter(
                (_, index) => index !== indexToRemove
            )
        }));
    };

    const displayedSectionOrder = formData.sectionOrder.length
        ? formData.sectionOrder
        : supportedSections;


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

        if (saveInProgress.current) return;

        clearTimeout(autosaveTimer.current);


        if (!selectedTemplateId) {

            setError(
                "No template selected."
            );

            return;
        }


        setError("");

        saveInProgress.current = true;
        setLoading(true);


        try {

            if (autosaveRequest.current) {
                await autosaveRequest.current.catch(() => {});
            }

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

            lastSavedSnapshot.current = JSON.stringify(portfolioData);
            setSavedSnapshotState(lastSavedSnapshot.current);
            autosaveRevision.current += 1;
            setAutosaveStatus("Saved");


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
                setProfileImageFile(null);
                setResumeFile(null);
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

            saveInProgress.current = false;
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

            {importMessage && <p role="status">{importMessage}</p>}

            {reviewProposal && (
                <ProposedChangesReview
                    key={reviewProposal.id}
                    proposal={reviewProposal}
                    currentData={formData}
                    onAccept={applyProposal}
                    onReject={() => {
                        setReviewProposal(null);
                        setImportMessage("Proposal rejected. Your existing portfolio data was kept.");
                    }}
                    onCancel={() => setReviewProposal(null)}
                />
            )}

            {isEditMode && (
                <p role="status">Autosave: {autosaveStatus}</p>
            )}


            {isEditMode && (
                <section>
                    <h2>Template</h2>

                    <button
                        type="button"
                        onClick={handleTemplateSelectorToggle}
                    >
                        {showTemplateSelector
                            ? "Close Templates"
                            : "Change Template"}
                    </button>

                    {showTemplateSelector && (
                        <div>
                            <label htmlFor="portfolio-template">
                                Select a template
                            </label>

                            <select
                                id="portfolio-template"
                                value={selectedTemplateId || ""}
                                onChange={(event) =>
                                    setPortfolioTemplateId(event.target.value)
                                }
                                disabled={loadingTemplates}
                            >
                                {availableTemplates.map((template) => (
                                    <option
                                        key={template._id}
                                        value={template._id}
                                    >
                                        {template.name} ({template.category})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </section>
            )}

            <form onSubmit={handleSubmit}>

                <section>
                    <h2>Portfolio Customization</h2>

                    <div>
                        <label>
                            Primary color{" "}
                            <input
                                type="color"
                                value={formData.primaryColor}
                                onChange={(event) => handleBasicChange({
                                    target: { name: "primaryColor", value: event.target.value }
                                })}
                            />
                        </label>
                    </div>

                    <div>
                        <label>
                            Secondary color{" "}
                            <input
                                type="color"
                                value={formData.secondaryColor}
                                onChange={(event) => handleBasicChange({
                                    target: { name: "secondaryColor", value: event.target.value }
                                })}
                            />
                        </label>
                    </div>

                    <div>
                        <label>
                            Background color{" "}
                            <input
                                type="color"
                                value={formData.backgroundColor}
                                onChange={(event) => handleBasicChange({
                                    target: { name: "backgroundColor", value: event.target.value }
                                })}
                            />
                        </label>
                    </div>

                    <div>
                        <label>
                            Text color{" "}
                            <input
                                type="color"
                                value={formData.textColor}
                                onChange={(event) => handleBasicChange({
                                    target: { name: "textColor", value: event.target.value }
                                })}
                            />
                        </label>
                    </div>

                    <label>
                        Font{" "}
                        <select
                            name="fontFamily"
                            value={formData.fontFamily}
                            onChange={handleBasicChange}
                        >
                            {supportedFonts.map((font) => (
                                <option key={font} value={font}>{font}</option>
                            ))}
                        </select>
                    </label>

                    <h3>Visible sections</h3>
                    {supportedSections.map((section) => (
                        <label key={section}>
                            <input
                                type="checkbox"
                                checked={formData.sectionVisibility[section] !== false}
                                onChange={(event) => handleSectionVisibilityChange(
                                    section,
                                    event.target.checked
                                )}
                            />
                            {section.charAt(0).toUpperCase() + section.slice(1)}
                        </label>
                    ))}

                    <h3>Section order</h3>
                    <ol>
                        {displayedSectionOrder.map((section, index) => (
                            <li key={section}>
                                {section.charAt(0).toUpperCase() + section.slice(1)}{" "}
                                <button
                                    type="button"
                                    onClick={() => moveSection(index, -1)}
                                    disabled={index === 0}
                                    aria-label={`Move ${section} up`}
                                >
                                    Move up
                                </button>{" "}
                                <button
                                    type="button"
                                    onClick={() => moveSection(index, 1)}
                                    disabled={index === displayedSectionOrder.length - 1}
                                    aria-label={`Move ${section} down`}
                                >
                                    Move down
                                </button>
                            </li>
                        ))}
                    </ol>

                    <h3>Custom sections</h3>
                    {formData.customSections.map((section, index) => (
                        <div key={index}>
                            <input
                                type="text"
                                value={section.title}
                                maxLength={80}
                                placeholder="Section title"
                                onChange={(event) => updateCustomSection(
                                    index,
                                    "title",
                                    event.target.value
                                )}
                            />
                            <textarea
                                value={section.content}
                                maxLength={4000}
                                placeholder="Section content"
                                onChange={(event) => updateCustomSection(
                                    index,
                                    "content",
                                    event.target.value
                                )}
                            />
                            <button
                                type="button"
                                onClick={() => removeCustomSection(index)}
                            >
                                Remove section
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addCustomSection}
                        disabled={formData.customSections.length >= 10}
                    >
                        Add custom section
                    </button>

                    <h3>Search and social preview</h3>
                    <input
                        name="seoTitle"
                        type="text"
                        value={formData.seoTitle}
                        maxLength={70}
                        placeholder="SEO title (optional)"
                        onChange={handleBasicChange}
                    />
                    <textarea
                        name="seoDescription"
                        value={formData.seoDescription}
                        maxLength={200}
                        placeholder="SEO description (optional)"
                        onChange={handleBasicChange}
                    />
                </section>


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

                    <div>
                        <h3>Import from Resume</h3>
                        <p>Upload a PDF to prepare a reviewed import. Existing fields are not replaced automatically.</p>
                        <input
                            type="file"
                            accept="application/pdf,.pdf"
                            onChange={handleResumeImport}
                            disabled={Boolean(importBusy)}
                        />
                        {importBusy === "resume" && <span role="status"> Preparing resume import...</span>}
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

                    <button
                        type="button"
                        onClick={() => handleAiContentRequest("shortIntro", formData.shortIntro, {
                            title: formData.personal.title,
                            skills: formData.skills
                        }, "shortIntro")}
                        disabled={Boolean(importBusy)}
                    >
                        {importBusy === "ai-shortIntro" ? "Preparing..." : "AI Assist - Short Introduction"}
                    </button>


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

                    <button
                        type="button"
                        onClick={() => handleAiContentRequest("about", formData.about, {
                            title: formData.personal.title,
                            skills: formData.skills
                        }, "about")}
                        disabled={Boolean(importBusy)}
                    >
                        {importBusy === "ai-about" ? "Preparing..." : "AI Assist - Summary"}
                    </button>

                </section>


                {/* =====================================
                    SKILLS
                ====================================== */}

                <section>

                    <h2>
                        Skills
                    </h2>

                    <button
                        type="button"
                        onClick={() => handleAiContentRequest("skills", formData.skills.join(", "), {
                            title: formData.personal.title,
                            skills: formData.skills
                        }, "skills")}
                        disabled={Boolean(importBusy)}
                    >
                        {importBusy === "ai-skills" ? "Preparing..." : "AI Assist - Skills"}
                    </button>


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
                                    onClick={() => handleAiContentRequest("experienceDescription", experience.description, {
                                        role: experience.role,
                                        title: formData.personal.title,
                                        existingDescription: experience.description.slice(0, 500)
                                    }, `experience.${index}`)}
                                    disabled={Boolean(importBusy)}
                                >
                                    {importBusy === `ai-experience.${index}` ? "Preparing..." : "AI Assist - Experience Description"}
                                </button>


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

                    <h2>Import from GitHub</h2>
                    <label>
                        GitHub username or profile URL{" "}
                        <input
                            value={githubReference}
                            onChange={(event) => setGithubReference(event.target.value)}
                            maxLength={300}
                        />
                    </label>
                    <button type="button" onClick={handleGitHubImport} disabled={Boolean(importBusy) || !githubReference.trim()}>
                        {importBusy === "github" ? "Preparing import..." : "Import from GitHub"}
                    </button>

                </section>


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

                                <button
                                    type="button"
                                    onClick={() => handleAiContentRequest("projectDescription", project.description, {
                                        projectTitle: project.title,
                                        technologies: project.technologies,
                                        existingDescription: project.description.slice(0, 500)
                                    }, `projects.${projectIndex}`)}
                                    disabled={Boolean(importBusy)}
                                >
                                    {importBusy === `ai-projects.${projectIndex}` ? "Preparing..." : "AI Assist - Project Description"}
                                </button>


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
