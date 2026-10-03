import { useCallback, useEffect, useRef, useState } from "react";
import {
    useNavigate,
    useParams,
    useSearchParams
} from "react-router-dom";

import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
import ProposedChangesReview from "../components/ProposedChangesReview";
import AIEnhanceField from "../components/AIEnhanceField";
import BuilderImports from "../components/BuilderImports";
import TemplatePricing from "../components/TemplatePricing";
import { getTemplateGenerationCost } from "../utils/templatePricing";
import { validateProposedPortfolioData } from "../utils/proposedPortfolioData";

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
    const { user, refreshUser } = useAuth();

    const { id } = useParams();

    const [searchParams] = useSearchParams();

    const templateFromUrl = searchParams.get("template");
    const professionFromUrl = searchParams.get("profession");

    const isEditMode = Boolean(id);
    const [createdPortfolioId, setCreatedPortfolioId] = useState(null);
    const identityLocked = isEditMode || Boolean(createdPortfolioId);
    const newBuilderEmailPrefilled = useRef(false);


    // --------------------------------------------------
    // Template
    // --------------------------------------------------

    const [portfolioTemplateId, setPortfolioTemplateId] =
        useState(null);

    const [availableTemplates, setAvailableTemplates] =
        useState([]);

    const [selectedTemplateDetails, setSelectedTemplateDetails] = useState(null);

    const [showTemplateSelector, setShowTemplateSelector] =
        useState(false);

    const [loadingTemplates, setLoadingTemplates] =
        useState(false);

    const selectedTemplateId = isEditMode
        ? portfolioTemplateId
        : templateFromUrl;
    const selectedTemplateCost = selectedTemplateDetails?.id === selectedTemplateId
        ? getTemplateGenerationCost(selectedTemplateDetails.template)
        : null;

    useEffect(() => {
        if (!selectedTemplateId) {
            return undefined;
        }

        let isCurrent = true;
        api.get(`/templates/${selectedTemplateId}`)
            .then((response) => {
                if (isCurrent) {
                    setSelectedTemplateDetails({
                        id: selectedTemplateId,
                        template: response.data.template
                    });
                }
            })
            .catch(() => {
                if (isCurrent) setSelectedTemplateDetails(null);
            });

        return () => {
            isCurrent = false;
        };
    }, [selectedTemplateId]);


    // --------------------------------------------------
    // Loading / Error
    // --------------------------------------------------

    const [loading, setLoading] = useState(false);

    const [error, setError] = useState("");
    const [reviewOpen, setReviewOpen] = useState(false);
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

    const [uploadedResumePath, setUploadedResumePath] =
        useState("");

    const [uploadedResumeOriginalName, setUploadedResumeOriginalName] = useState("");
    const [profileImageOriginalName, setProfileImageOriginalName] = useState("");
    const [profileImagePreview, setProfileImagePreview] = useState(null);
    const [localProfileImagePreviewUrl, setLocalProfileImagePreviewUrl] = useState("");
    const localProfileImagePreviewRef = useRef("");
    const [assetAction, setAssetAction] = useState("");

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
            profileImage: "",
            profileImageOriginalName: ""
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

    useEffect(() => {
        if (isEditMode || !user?.email || newBuilderEmailPrefilled.current) return;
        setFormData((current) => {
            if (current.personal.email) return current;
            newBuilderEmailPrefilled.current = true;
            return {
                ...current,
                personal: { ...current.personal, email: user.email }
            };
        });
    }, [isEditMode, user?.email]);


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
    const [githubImportModal, setGithubImportModal] = useState("");
    const [githubCreditsAvailable, setGithubCreditsAvailable] = useState(null);
    const githubImportLock = useRef(false);
    const [reviewProposal, setReviewProposal] = useState(null);
    const [proposalActionBusy, setProposalActionBusy] = useState(false);
    const reviewProposalRef = useRef(null);
    const restoredGitHubReviewKey = useRef("");
    const githubReviewOwnerId = user?.id || user?._id;
    const githubReviewStorageKey = githubReviewOwnerId
        ? `portfolio-builder-github-review:${githubReviewOwnerId}:${id || "new"}`
        : null;

    const updateGitHubReviewDecisions = useCallback((decisions) => {
        setReviewProposal((current) => {
            if (current?.source !== "GitHub" || JSON.stringify(current.repositoryDecisions || []) === JSON.stringify(decisions)) {
                return current;
            }
            return { ...current, repositoryDecisions: decisions };
        });
    }, []);

    const clearStoredGitHubReview = useCallback(() => {
        if (!githubReviewStorageKey) return;
        try {
            window.sessionStorage.removeItem(githubReviewStorageKey);
        } catch {
            // The server expiry job still refunds abandoned pending reservations.
        }
    }, [githubReviewStorageKey]);

    useEffect(() => {
        if (reviewProposal) {
            reviewProposalRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, [reviewProposal]);

    useEffect(() => {
        const imageReference = formData.personal.profileImage;
        if (!id || !/^uploads\//i.test(imageReference || "")) return undefined;

        let active = true;
        let objectUrl = "";
        api.get(`/uploads/${id}/profile-image`, { responseType: "blob" })
            .then((response) => {
                if (!active) return;
                objectUrl = URL.createObjectURL(response.data);
                setProfileImagePreview({ reference: imageReference, url: objectUrl });
                if (localProfileImagePreviewRef.current) {
                    URL.revokeObjectURL(localProfileImagePreviewRef.current);
                    localProfileImagePreviewRef.current = "";
                    setLocalProfileImagePreviewUrl("");
                }
            })
            .catch(() => {});

        return () => {
            active = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [formData.personal.profileImage, id]);

    useEffect(() => () => {
        if (localProfileImagePreviewRef.current) URL.revokeObjectURL(localProfileImagePreviewRef.current);
    }, []);

    const pendingFiles = {
        ...(profileImageFile ? { profileImage: profileImageFile.name } : {}),
        ...(resumeFile ? { resume: resumeFile.name } : {})
    };
    const hasUploadedResume = Boolean(
        isEditMode && uploadedResumePath && portfolioLoaded && !loading && !uploadingFiles && !assetAction
    );
    const canAnalyzeResume = Boolean(hasUploadedResume && !importBusy && !reviewProposal);

    useEffect(() => {
        if (!githubReviewStorageKey || (isEditMode && !portfolioLoaded) || restoredGitHubReviewKey.current === githubReviewStorageKey) return;
        restoredGitHubReviewKey.current = githubReviewStorageKey;
        let active = true;
        try {
            const saved = JSON.parse(window.sessionStorage.getItem(githubReviewStorageKey) || "null");
            if (
                saved?.source === "GitHub" &&
                /^[a-f\d]{24}$/i.test(saved.creditReservationId || "") &&
                Array.isArray(saved.repositories) &&
                !validateProposedPortfolioData(saved.data || {})
            ) {
                window.setTimeout(() => {
                    if (!active) return;
                    setReviewProposal({ ...saved, id: Date.now() });
                    setImportMessage("Your pending GitHub review was restored. Apply it or cancel it to resolve the reserved credits.");
                }, 0);
            } else if (saved) {
                clearStoredGitHubReview();
            }
        } catch {
            clearStoredGitHubReview();
        }
        return () => { active = false; };
    }, [githubReviewStorageKey, isEditMode, portfolioLoaded, clearStoredGitHubReview]);

    useEffect(() => {
        if (reviewProposal?.source !== "GitHub" || !reviewProposal.creditReservationId || !githubReviewStorageKey) return;
        try {
            window.sessionStorage.setItem(githubReviewStorageKey, JSON.stringify(reviewProposal));
        } catch {
            // Server-side expiry cleanup remains authoritative if session storage is unavailable.
        }
    }, [githubReviewStorageKey, reviewProposal]);
    const profileImageReference = formData.personal.profileImage || "";
    const profileImagePreviewSrc = profileImageFile
        ? localProfileImagePreviewUrl
        : /^https?:\/\//i.test(profileImageReference)
            ? profileImageReference
            : profileImagePreview?.reference === profileImageReference
                ? profileImagePreview.url
                : "";
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
            const response = await api.get("/templates", {
                params: professionFromUrl ? { profession: professionFromUrl } : {}
            });
            setAvailableTemplates(response.data.templates);
        } catch (error) {
            console.error(error);
            setError("Failed to load templates");
        } finally {
            setLoadingTemplates(false);
        }
    };

    const showProposal = (source, data, replacements = {}, repositories = [], creditReservationId = null) => {
        const validationError = validateProposedPortfolioData(data);
        if (validationError) {
            setImportMessage("The imported content was invalid and has not changed your portfolio.");
            return false;
        }
        setReviewProposal({ source, data, replacements, repositories, creditReservationId, id: Date.now() });
        setImportMessage("");
        return true;
    };

    const openGitHubImportConfirmation = () => {
        if (importBusy || githubImportLock.current || reviewProposal) return;
        setImportMessage("");
        if ((user?.credits ?? 0) < 2) {
            setGithubCreditsAvailable(user?.credits ?? 0);
            setGithubImportModal("insufficient");
            return;
        }
        setGithubImportModal("confirm");
    };

    const handleGitHubImport = async () => {
        if (githubImportLock.current || (user?.credits ?? 0) < 2) return;
        githubImportLock.current = true;
        setGithubImportModal("");
        setImportBusy("github");
        setImportMessage("");
        try {
            const response = await api.post("/import/github", { reference: githubReference });
            let balanceRefreshFailed = false;
            try {
                await refreshUser();
            } catch {
                // The backend response remains authoritative; a later refresh will reconcile the displayed balance.
                balanceRefreshFailed = true;
            }
            let proposalCreated = false;
            if (response.data.proposedData) {
                proposalCreated = showProposal("GitHub", response.data.proposedData, {}, response.data.repositories || [], response.data.creditReservationId);
            }
            else if (Array.isArray(response.data.repositories) && response.data.repositories.length) {
                setReviewProposal({
                    source: "GitHub",
                    data: {},
                    repositories: response.data.repositories,
                    creditReservationId: response.data.creditReservationId,
                    id: Date.now()
                });
                proposalCreated = true;
            }
            else setImportMessage(response.data.message || "No GitHub data was imported.");
            if (!proposalCreated && response.data.creditReservationId) {
                try {
                    await api.post(`/import/github/reservations/${response.data.creditReservationId}/refund`, {});
                    await refreshUser();
                    setImportMessage("The GitHub review could not be created, so the reserved credits were returned.");
                } catch {
                    setImportMessage("The GitHub review could not be created and its reserved credits could not be confirmed as returned.");
                }
            }
            if (balanceRefreshFailed && proposalCreated) {
                setImportMessage("GitHub import is ready for review and its 2-credit charge succeeded, but your balance did not refresh. Refresh your account before another import.");
            }
        } catch (requestError) {
            let balanceRefreshFailed = false;
            try {
                await refreshUser();
            } catch {
                // Keep the existing auth state if the refresh itself is unavailable.
                balanceRefreshFailed = true;
            }
            if (requestError.response?.data?.code === "INSUFFICIENT_CREDITS") {
                setGithubCreditsAvailable(Number.isInteger(requestError.response.data.availableCredits)
                    ? requestError.response.data.availableCredits
                    : user?.credits ?? 0);
                setGithubImportModal("insufficient");
            } else {
                const message = requestError.response?.data?.message || "GitHub import is currently unavailable.";
                setImportMessage(balanceRefreshFailed ? `${message} Your credit balance could not be refreshed.` : message);
            }
        } finally {
            githubImportLock.current = false;
            setImportBusy("");
        }
    };

    const handleResumeAnalysis = async () => {
        if (!canAnalyzeResume) {
            setImportMessage(!id
                ? "Create the portfolio before analyzing a resume."
                : "Upload a PDF resume before analyzing it.");
            return;
        }

        setImportBusy("resume-analysis");
        setImportMessage("");
        try {
            const response = await api.post("/import/resume/analyze", { portfolioId: id });
            const proposedData = response.data?.proposedData;
            if (response.data?.status === "ready" && proposedData) {
                showProposal("AI Resume Analysis", proposedData);
            } else {
                setImportMessage(response.data?.message || "No resume analysis was returned.");
            }
        } catch (requestError) {
            setImportMessage(requestError.response?.data?.message || "Resume analysis is currently unavailable. Your data was not changed.");
        } finally {
            setImportBusy("");
        }
    };

    const applyProposal = async (mergedData) => {
        const proposal = reviewProposal;
        if (proposalActionBusy) return;
        setProposalActionBusy(true);
        let creditRefreshFailed = false;
        try {
            if (proposal?.source === "GitHub" && proposal.creditReservationId) {
                await api.post(`/import/github/reservations/${proposal.creditReservationId}/commit`, {});
            }
        } catch (requestError) {
            setImportMessage(requestError.response?.data?.message || "The GitHub import could not be applied. Your projects were not changed.");
            setProposalActionBusy(false);
            return;
        }

        if (proposal?.source === "GitHub") clearStoredGitHubReview();
        setFormData({
            ...mergedData,
            projects: [...(mergedData.projects || [])]
        });
        setReviewProposal(null);
        try {
            await refreshUser();
        } catch {
            creditRefreshFailed = true;
        }
        setImportMessage(isEditMode
            ? "Selected changes were applied. Autosave will keep them in your portfolio."
            : "Selected changes were applied. Save your portfolio to keep them.");
        if (creditRefreshFailed) {
            setImportMessage("Changes were applied, but your credit balance did not refresh. Reload your account to see the current balance.");
        }
        setProposalActionBusy(false);
    };

    const dismissProposal = async (reason) => {
        const proposal = reviewProposal;
        if (!proposal || proposalActionBusy) return;
        setProposalActionBusy(true);
        try {
            if (proposal.source === "GitHub" && proposal.creditReservationId) {
                await api.post(`/import/github/reservations/${proposal.creditReservationId}/refund`, {});
            }
            if (proposal.source === "GitHub") clearStoredGitHubReview();
            setReviewProposal(null);
            setImportMessage(reason === "cancel"
                ? "Import canceled. Any reserved GitHub credits were returned."
                : "Proposal rejected. Your existing portfolio data was kept; any reserved GitHub credits were returned.");
            try {
                await refreshUser();
            } catch {
                setImportMessage("The import was closed, but your credit balance did not refresh. Reload your account to see the current balance.");
            }
        } catch (requestError) {
            setImportMessage(requestError.response?.data?.message || "The reserved GitHub credits could not be confirmed as refunded. The review remains open so you can retry.");
        } finally {
            setProposalActionBusy(false);
        }
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

                setUploadedResumePath(portfolio.resume || "");
                setUploadedResumeOriginalName(portfolio.resumeOriginalName || "");
                setProfileImageOriginalName(portfolio.personal?.profileImageOriginalName || "");

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
                            "",
                        profileImageOriginalName:
                            portfolio.personal?.profileImageOriginalName || ""
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
            uploadingFiles ||
            reviewOpen
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
        reviewOpen,
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

    const applyEnhancedText = (field, index, text) => {
        if (field === "shortIntro" || field === "about") {
            setFormData((previous) => ({ ...previous, [field]: text }));
            return;
        }

        const section = field.split(".")[0];
        setFormData((previous) => ({
            ...previous,
            [section]: previous[section].map((item, itemIndex) =>
                itemIndex === index ? { ...item, description: text } : item
            )
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

    const handleProfileImageChange = async (event) => {

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
        setImportMessage("");

        if (id) {
            setUploadingFiles(true);
            const uploadData = new FormData();
            uploadData.append("profileImage", file);
            try {
                const uploadResponse = await api.post(`/uploads/${id}`, uploadData, {
                    headers: { "Content-Type": "multipart/form-data" }
                });
                const uploadedPortfolio = uploadResponse.data?.portfolio;
                const imageReference = uploadedPortfolio?.personal?.profileImage;
                if (typeof imageReference !== "string" || !imageReference) {
                    throw new Error("Profile image upload response was invalid");
                }
                setFormData((previous) => ({
                    ...previous,
                    personal: {
                        ...previous.personal,
                        profileImage: imageReference,
                        profileImageOriginalName: uploadedPortfolio.personal.profileImageOriginalName || file.name
                    }
                }));
                setProfileImageOriginalName(uploadedPortfolio.personal.profileImageOriginalName || file.name);
                setProfileImageFile(null);
                setImportMessage("Profile image uploaded.");
                event.target.value = "";
            } catch (uploadError) {
                console.error("Profile image upload failed:", uploadError.response?.status || "request failed");
                setError(uploadError.response?.data?.message || "Failed to upload profile image");
            } finally {
                setUploadingFiles(false);
            }
            return;
        }

        if (localProfileImagePreviewRef.current) URL.revokeObjectURL(localProfileImagePreviewRef.current);
        localProfileImagePreviewRef.current = URL.createObjectURL(file);
        setLocalProfileImagePreviewUrl(localProfileImagePreviewRef.current);
        setProfileImageFile(file);
    };


    // ==================================================
    // RESUME
    // ==================================================

    const handleResumeChange = async (event) => {

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
        setImportMessage("");

        // Existing portfolios can upload immediately through the same authenticated
        // endpoint used by Save/Update. Only the server-returned portfolio reference
        // enables analysis; a browser file path is never used.
        if (id) {
            // Keep the old reference until a replacement has succeeded; uploadingFiles
            // disables analysis while the replacement is in progress.
            setUploadingFiles(true);
            const uploadData = new FormData();
            uploadData.append("resume", file);

            try {
                const uploadResponse = await api.post(`/uploads/${id}`, uploadData, {
                    headers: { "Content-Type": "multipart/form-data" }
                });
                const resumePath = uploadResponse.data?.portfolio?.resume;
                if (typeof resumePath !== "string" || !resumePath) {
                    throw new Error("Resume upload response was invalid");
                }
                setUploadedResumePath(resumePath);
                setUploadedResumeOriginalName(uploadResponse.data?.portfolio?.resumeOriginalName || file.name);
                setResumeFile(null);
                setImportMessage("Resume uploaded. You can now analyze it with AI.");
                event.target.value = "";
            } catch (uploadError) {
                console.error("Resume upload failed:", uploadError.response?.status || "request failed");
                setError(uploadError.response?.data?.message || "Failed to upload resume");
            } finally {
                setUploadingFiles(false);
            }
            return;
        }

        // A new portfolio has no server-owned ID until its initial create succeeds.
        // Keep the existing create-and-upload flow for that case.
        setResumeFile(file);
    };

    const handleRemoveAsset = async (kind) => {
        if (!id || assetAction || uploadingFiles) return;
        const label = kind === "resume" ? "resume" : "profile image";
        if (!window.confirm(`Remove this ${label}?`)) return;

        setAssetAction(kind);
        setError("");
        setImportMessage("");
        try {
            const endpoint = kind === "resume" ? "resume" : "profile-image";
            const response = await api.delete(`/uploads/${id}/${endpoint}`);
            if (kind === "resume") {
                setUploadedResumePath(response.data?.portfolio?.resume || "");
                setUploadedResumeOriginalName(response.data?.portfolio?.resumeOriginalName || "");
            } else {
                const updatedPersonal = response.data?.portfolio?.personal || {};
                setFormData((previous) => ({
                    ...previous,
                    personal: {
                        ...previous.personal,
                        profileImage: updatedPersonal.profileImage || "",
                        profileImageOriginalName: updatedPersonal.profileImageOriginalName || ""
                    }
                }));
                setProfileImageOriginalName(updatedPersonal.profileImageOriginalName || "");
                setProfileImagePreview(null);
                if (localProfileImagePreviewRef.current) {
                    URL.revokeObjectURL(localProfileImagePreviewRef.current);
                    localProfileImagePreviewRef.current = "";
                    setLocalProfileImagePreviewUrl("");
                }
            }
            setImportMessage(`${kind === "resume" ? "Resume" : "Profile image"} removed.`);
        } catch (removeError) {
            setError(removeError.response?.data?.message || `Failed to remove ${label}.`);
        } finally {
            setAssetAction("");
        }
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

    const handleSubmit = (event) => {
        event.preventDefault();

        if (saveInProgress.current) return;
        if (reviewProposal || proposalActionBusy) {
            setError("Apply, reject, or cancel the pending review before saving this portfolio.");
            return;
        }

        if (!selectedTemplateId) {

            setError(
                "No template selected."
            );

            return;
        }


        clearTimeout(autosaveTimer.current);
        setError("");
        setReviewOpen(true);
    };

    const submitReviewedPortfolio = async () => {
        if (saveInProgress.current || !reviewOpen) return;
        setError("");

        const resumeUploadPending = Boolean(resumeFile);
        const updatingExisting = isEditMode || Boolean(createdPortfolioId);

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

            if (updatingExisting) {

                response = await api.put(
                    `/portfolios/${id || createdPortfolioId}`,
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

            if (!updatingExisting) setCreatedPortfolioId(savedPortfolio._id);

            setReviewOpen(false);

            if (!updatingExisting) {
                try {
                    await refreshUser();
                } catch {
                    // Draft creation does not affect credits; keep the successful save intact.
                }
            }

            lastSavedSnapshot.current = JSON.stringify(portfolioData);
            setSavedSnapshotState(lastSavedSnapshot.current);
            autosaveRevision.current += 1;
            setAutosaveStatus("Saved");


            const portfolioId =
                savedPortfolio._id;


            console.log(
                updatingExisting
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


                const uploadResponse = await api.post(
                    `/uploads/${portfolioId}`,
                    uploadData,
                    {
                        headers: {
                            "Content-Type":
                                "multipart/form-data"
                        }
                    }
                );

                if (resumeFile) {
                    setUploadedResumePath(uploadResponse.data?.portfolio?.resume || "");
                    setUploadedResumeOriginalName(uploadResponse.data?.portfolio?.resumeOriginalName || resumeFile.name);
                }
                if (profileImageFile) {
                    const uploadedPersonal = uploadResponse.data?.portfolio?.personal || {};
                    setProfileImageOriginalName(uploadedPersonal.profileImageOriginalName || profileImageFile.name);
                    setFormData((previous) => ({
                        ...previous,
                        personal: {
                            ...previous.personal,
                            profileImage: uploadedPersonal.profileImage || previous.personal.profileImage,
                            profileImageOriginalName: uploadedPersonal.profileImageOriginalName || profileImageFile.name
                        }
                    }));
                }


                setUploadingFiles(false);
                setProfileImageFile(null);
                setResumeFile(null);
            }


            // ------------------------------------------
            // Finished
            // ------------------------------------------

            if (resumeUploadPending) {
                if (!updatingExisting) navigate(`/builder/edit/${portfolioId}`);
                else setImportMessage("Resume uploaded. You can now analyze it with AI.");
            } else {
                navigate("/dashboard");
            }

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
                <div ref={reviewProposalRef}>
                    <ProposedChangesReview
                        key={reviewProposal.id}
                        proposal={reviewProposal}
                        currentData={formData}
                        actionBusy={proposalActionBusy}
                        onDecisionChange={updateGitHubReviewDecisions}
                        onAccept={applyProposal}
                        onReject={() => dismissProposal("reject")}
                        onCancel={() => dismissProposal("cancel")}
                    />
                </div>
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
                                        {template.name} ({template.category}) — {template.isPremium ? "Premium" : "Standard"}, {getTemplateGenerationCost(template) ?? "cost unavailable"} credits on first download
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </section>
            )}

            {selectedTemplateDetails?.id === selectedTemplateId && (
                <section aria-label="Selected template">
                    <h2>Template: {selectedTemplateDetails.template.name}</h2>
                    <TemplatePricing template={selectedTemplateDetails.template} />
                    <p>Your credits: {user?.credits ?? 0}</p>
                    <p>Creating and editing are free. {selectedTemplateCost === null ? "The first-download cost is unavailable." : `${selectedTemplateCost} credits are charged on the first successful download; later downloads are free.`}</p>
                </section>
            )}

            <BuilderImports
                uploadedResumePath={uploadedResumePath}
                uploadedResumeOriginalName={uploadedResumeOriginalName}
                resumeFile={resumeFile}
                id={id}
                uploadingFiles={uploadingFiles}
                assetAction={assetAction}
                importBusy={importBusy}
                hasUploadedResume={hasUploadedResume}
                canAnalyzeResume={canAnalyzeResume}
                onResumeChange={handleResumeChange}
                onResumeRemove={() => handleRemoveAsset("resume")}
                onResumeAnalyze={handleResumeAnalysis}
                githubReference={githubReference}
                onGithubReferenceChange={setGithubReference}
                onGithubImportOpen={openGitHubImportConfirmation}
                githubImportModal={githubImportModal}
                githubCreditsAvailable={githubCreditsAvailable}
                reviewPending={Boolean(reviewProposal)}
                credits={user?.credits ?? 0}
                onGithubModalClose={() => setGithubImportModal("")}
                onGithubImport={handleGitHubImport}
            />

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
                        readOnly={identityLocked}
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
                        readOnly={identityLocked}
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

                    <h2>Profile Image</h2>


                    {/* Profile Image */}

                    <div>

                        <label>
                            {formData.personal.profileImage ? "Replace Image" : "Upload Profile Image"}
                        </label>

                        <br />

                        <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={uploadingFiles || Boolean(assetAction)}
                            onChange={
                                handleProfileImageChange
                            }
                        />

                        {profileImagePreviewSrc && (
                            <p>
                                <img src={profileImagePreviewSrc} alt="Profile image preview" style={{ maxWidth: "160px", maxHeight: "160px", objectFit: "cover" }} />
                            </p>
                        )}

                        {formData.personal.profileImage && profileImageOriginalName && (
                            <p role="status">{profileImageOriginalName}</p>
                        )}

                        {formData.personal.profileImage && id && (
                            <button
                                type="button"
                                onClick={() => handleRemoveAsset("profileImage")}
                                disabled={uploadingFiles || Boolean(assetAction)}
                            >
                                {assetAction === "profileImage" ? "Removing Image..." : "Remove Profile Image"}
                            </button>
                        )}


                        {profileImageFile && (

                            <p>

                                Selected:
                                {" "}
                                {profileImageFile.name}

                            </p>
                        )}

                    </div>


                    <br />


                </section>


                {/* =====================================
                    SHORT INTRODUCTION
                ====================================== */}

                <section>

                    <h2>
                        Short Introduction
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
                    <AIEnhanceField
                        field="shortIntro"
                        text={formData.shortIntro}
                        onApply={(text) => applyEnhancedText("shortIntro", null, text)}
                    />

                </section>

                <section>

                    <h2>About</h2>

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
                    <AIEnhanceField
                        field="about"
                        text={formData.about}
                        onApply={(text) => applyEnhancedText("about", null, text)}
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
                                <AIEnhanceField
                                    field="education.description"
                                    text={education.description}
                                    onApply={(text) => applyEnhancedText("education.description", index, text)}
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
                                <AIEnhanceField
                                    field="experience.description"
                                    text={experience.description}
                                    onApply={(text) => applyEnhancedText("experience.description", index, text)}
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
                                <AIEnhanceField
                                    field="projects.description"
                                    text={project.description}
                                    onApply={(text) => applyEnhancedText("projects.description", projectIndex, text)}
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
                    SUBMIT
                ====================================== */}

                <p>
                    Creating and editing are free.
                    {selectedTemplateDetails?.id === selectedTemplateId && (selectedTemplateCost === null
                        ? " The first-download cost is currently unavailable."
                        : ` The first successful download costs ${selectedTemplateCost} credits; later downloads are free.`)}
                </p>

                <button
                    type="submit"
                    disabled={
                        loading ||
                        uploadingFiles ||
                        Boolean(reviewProposal) ||
                        proposalActionBusy
                    }
                >

                    {uploadingFiles
                        ? "Uploading Files..."
                        : loading
                            ? "Saving..."
                            : identityLocked
                                ? "Update Portfolio"
                                : "Create Portfolio"}

                </button>


            </form>

            {reviewOpen && (
                <div role="dialog" aria-modal="true" aria-labelledby="portfolio-review-title" style={{ position: "fixed", inset: 0, zIndex: 1000, overflow: "auto", background: "rgba(0,0,0,.65)", padding: "2rem" }}>
                    <section style={{ maxWidth: "900px", margin: "0 auto", background: "white", color: "#111", padding: "1.5rem", borderRadius: "8px" }}>
                        <h2 id="portfolio-review-title">Review portfolio information</h2>
                        <p>Name: {formData.personal.name || "—"}</p>
                        <p>Email: {formData.personal.email || "—"}</p>
                        <p>Phone: {formData.personal.phone || "—"}</p>
                        <p>Location: {formData.personal.location || "—"}</p>
                        <p>Short introduction: {formData.shortIntro || "—"}</p>
                        <p>About: {formData.about || "—"}</p>
                        <p>Skills: {formData.skills.filter(Boolean).join(", ") || "—"}</p>
                        <h3>Education</h3>
                        {formData.education.map((item, index) => <p key={`edu-${index}`}>{item.degree} — {item.institution} ({item.startYear}–{item.endYear}) {item.description}</p>)}
                        <h3>Experience</h3>
                        {formData.experience.map((item, index) => <p key={`exp-${index}`}>{item.role} — {item.company} ({item.startDate}–{item.endDate}) {item.description}</p>)}
                        <h3>Projects</h3>
                        {formData.projects.map((item, index) => <p key={`project-${index}`}>{item.title}: {item.description} {item.technologies?.join(", ")}</p>)}
                        <h3>Social links</h3>
                        <p>GitHub: {formData.social.github || "—"} · LinkedIn: {formData.social.linkedin || "—"} · Twitter: {formData.social.twitter || "—"}</p>
                        <h3>Template and customization</h3>
                        <p>{selectedTemplateDetails?.template?.name || "Selected template"} · {formData.fontFamily} · {formData.primaryColor} / {formData.secondaryColor} / {formData.backgroundColor} / {formData.textColor}</p>
                        <p>Visible sections: {Object.entries(formData.sectionVisibility).filter(([, visible]) => visible).map(([section]) => section).join(", ") || "none"}; order: {formData.sectionOrder.join(" → ") || "default"}</p>
                        {formData.customSections.map((section, index) => <p key={`custom-${index}`}>{section.title}: {section.content}</p>)}
                        {error && <p role="alert">{error}</p>}
                        <button type="button" disabled={loading || uploadingFiles} onClick={() => setReviewOpen(false)}>Back</button>{" "}
                        <button type="button" disabled={loading || uploadingFiles} onClick={submitReviewedPortfolio}>
                            {uploadingFiles ? "Uploading files…" : loading ? "Saving…" : "Proceed"}
                        </button>
                    </section>
                </div>
            )}

        </div>
    );
}

export default Builder;
