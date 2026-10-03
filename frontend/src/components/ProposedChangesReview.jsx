import { useEffect, useState } from "react";
import {
    mergeProposedPortfolioData,
    validateProposedPortfolioData,
    reconcileGitHubProjects
} from "../utils/proposedPortfolioData";

const scalarGroups = [
    ["personal", "Personal information"],
    ["social", "Social links"]
];
const arrayFields = ["skills", "education", "experience", "projects"];
const displayValue = (value) => value === undefined || value === null || value === "" ? "(empty)" : String(value);

function ProposedChangesReview({ proposal, currentData, onAccept, onReject, onCancel, onDecisionChange, actionBusy = false }) {
    const data = proposal.data || {};
    const validationError = validateProposedPortfolioData(data);
    const [selectedFields, setSelectedFields] = useState({});
    const [selectedArrays, setSelectedArrays] = useState({});
    const [selectedReplacements, setSelectedReplacements] = useState({});
    const repositories = Array.isArray(proposal.repositories) ? proposal.repositories : [];
    const isGitHubImport = proposal.source === "GitHub";
    const githubMatches = reconcileGitHubProjects(currentData.projects, repositories);
    const [repositoryDecisions, setRepositoryDecisions] = useState(() =>
        Array.isArray(proposal.repositoryDecisions) && proposal.repositoryDecisions.length === repositories.length
            ? proposal.repositoryDecisions
            : repositories.map(() => "")
    );
    const [selectedRepositories, setSelectedRepositories] = useState(() => repositories.map((repo) => repo.selected !== false));
    const replacements = proposal.replacements || {};
    const invalidReplacement = Object.entries(replacements).some(([path, value]) => {
        const match = /^(experience|projects)\.(\d+)\.description$/.exec(path);
        return !match || Number(match[2]) >= (currentData[match[1]] || []).length ||
            typeof value !== "string" || value.length > 2000;
    });

    useEffect(() => {
        if (isGitHubImport) onDecisionChange?.(repositoryDecisions);
    }, [isGitHubImport, onDecisionChange, repositoryDecisions]);

    const setFieldSelected = (key, checked) => setSelectedFields((current) => ({ ...current, [key]: checked }));
    const setArraySelected = (field, index, checked) => setSelectedArrays((current) => ({
        ...current,
        [field]: { ...(current[field] || {}), [index]: checked }
    }));
    const chooseRepositoryDecision = (index, action) => {
        setRepositoryDecisions((current) => current.map((decision, itemIndex) =>
            itemIndex === index ? action : decision
        ));
    };

    const toProject = (repo) => ({
        title: repo.name || "",
        description: repo.description || "",
        technologies: Array.isArray(repo.technologies) ? repo.technologies : [],
        githubUrl: repo.githubUrl || "",
        liveUrl: repo.liveUrl || ""
    });

    const accept = () => onAccept(mergeProposedPortfolioData(
        currentData,
        data,
        selectedFields,
        selectedArrays,
        replacements,
        selectedReplacements,
        isGitHubImport ? [] : repositories.filter((_, index) => selectedRepositories[index]).map((repo) => ({
            title: repo.name,
            description: repo.description || "",
            technologies: Array.isArray(repo.technologies) ? repo.technologies : [],
            githubUrl: repo.githubUrl || "",
            liveUrl: repo.liveUrl || ""
        })),
        isGitHubImport ? repositories.map((repo, index) => ({
            project: toProject(repo),
            action: repositoryDecisions[index],
            projectIndex: githubMatches[index]?.projectIndex
        })) : []
    ));

    const selectAllRepositories = (selected) => setSelectedRepositories(repositories.map(() => selected));

    return (
        <section aria-label="Review proposed changes">
            <h2>Review {proposal.source || "proposed"} changes</h2>
            <p>Nothing will change in your portfolio until you accept this proposal.</p>
            {(validationError || invalidReplacement) && <p role="alert">Imported content is invalid and cannot be applied.</p>}

            {scalarGroups.map(([group, title]) => Object.entries(data[group] || {}).map(([field, proposed]) => {
                const key = `${group}.${field}`;
                return (
                    <div key={key}>
                        <label>
                            <input type="checkbox" checked={selectedFields[key] !== false} onChange={(event) => setFieldSelected(key, event.target.checked)} />
                            Apply {title.toLowerCase()} · {field}
                        </label>
                        <p>Current: {displayValue(currentData[group]?.[field])}</p>
                        <p>Proposed: {displayValue(proposed)}</p>
                    </div>
                );
            }))}

            {["shortIntro", "about"].filter((field) => data[field] !== undefined).map((field) => (
                <div key={field}>
                    <label>
                        <input type="checkbox" checked={selectedFields[field] !== false} onChange={(event) => setFieldSelected(field, event.target.checked)} />
                        Apply {field === "about" ? "summary" : "short introduction"}
                    </label>
                    <p>Current: {displayValue(currentData[field])}</p>
                    <p>Proposed: {displayValue(data[field])}</p>
                </div>
            ))}

            {arrayFields.filter((field) => Array.isArray(data[field]) && !(isGitHubImport && field === "projects")).map((field) => (
                <fieldset key={field}>
                    <legend>Proposed {field} (current: {(currentData[field] || []).length})</legend>
                    {data[field].length === 0 && <p>No {field} entries were proposed.</p>}
                    {data[field].map((entry, index) => (
                        <label key={`${field}-${index}`}>
                            <input
                                type="checkbox"
                                checked={selectedArrays[field]?.[index] !== false}
                                onChange={(event) => setArraySelected(field, index, event.target.checked)}
                            />
                            {typeof entry === "string" ? entry : JSON.stringify(entry)}
                        </label>
                    ))}
                </fieldset>
            ))}

            {Object.entries(replacements).map(([path, proposed]) => {
                const [group, index, key] = path.split(".");
                return (
                    <div key={path}>
                        <label>
                            <input type="checkbox" checked={selectedReplacements[path] !== false} onChange={(event) => setSelectedReplacements((current) => ({ ...current, [path]: event.target.checked }))} />
                            Apply {group} #{Number(index) + 1} {key}
                        </label>
                        <p>Current: {displayValue(currentData[group]?.[Number(index)]?.[key])}</p>
                        <p>Proposed: {displayValue(proposed)}</p>
                    </div>
                );
            })}

            {repositories.length > 0 && (
                <fieldset>
                    <legend>{isGitHubImport ? "Review GitHub project matches" : "GitHub repositories to add as projects"}</legend>
                    {!isGitHubImport && <>
                        <button type="button" onClick={() => selectAllRepositories(true)}>Select All</button>{" "}
                        <button type="button" onClick={() => selectAllRepositories(false)}>Clear All</button>
                    </>}
                    {repositories.map((repo, index) => {
                        const match = githubMatches[index];
                        const decision = repositoryDecisions[index];
                        const matchedProject = match?.type === "likely-match" ? currentData.projects?.[match.projectIndex] : null;
                        return (
                            <div key={`${repo.githubUrl}-${index}`}>
                                {isGitHubImport ? (
                                    <>
                                        {matchedProject ? (
                                            <>
                                                <h3>Possible match detected</h3>
                                                <p><strong>Resume Project:</strong> {displayValue(matchedProject.title)}</p>
                                                <p>{displayValue(matchedProject.description)}</p>
                                                {matchedProject.technologies?.length > 0 && <p>{matchedProject.technologies.join(", ")}</p>}
                                                <p><strong>GitHub Repository:</strong> {repo.name}</p>
                                                <p>{repo.description || "(No GitHub description)"}</p>
                                                {repo.technologies?.length > 0 && <p>{repo.technologies.join(", ")}</p>}
                                                <p>{match.reason}</p>
                                                <button type="button" disabled={actionBusy} aria-pressed={decision === "merge"} onClick={() => chooseRepositoryDecision(index, "merge")}>
                                                    {decision === "merge" ? "Merge selected ✓" : "Merge"}
                                                </button>{" "}
                                                <button type="button" disabled={actionBusy} aria-pressed={decision === "add-separately"} onClick={() => chooseRepositoryDecision(index, "add-separately")}>
                                                    {decision === "add-separately" ? "Add Separately selected ✓" : "Add Separately"}
                                                </button>{" "}
                                            </>
                                        ) : (
                                            <>
                                                <h3>New GitHub Project</h3>
                                                <p><strong>{repo.name}</strong></p>
                                                <p>{repo.description || "(No GitHub description)"}</p>
                                                {repo.technologies?.length > 0 && <p>{repo.technologies.join(", ")}</p>}
                                                <button type="button" disabled={actionBusy} aria-pressed={decision === "add"} onClick={() => chooseRepositoryDecision(index, "add")}>
                                                    {decision === "add" ? "Add selected ✓" : "Add"}
                                                </button>{" "}
                                            </>
                                        )}
                                        <button type="button" disabled={actionBusy} aria-pressed={decision === "ignore"} onClick={() => chooseRepositoryDecision(index, "ignore")}>
                                            {decision === "ignore" ? "Ignore selected ✓" : "Ignore"}
                                        </button>
                                        {decision && (
                                            <p role="status">
                                                Decision recorded: {decision === "add-separately" ? "Add Separately" : decision.charAt(0).toUpperCase() + decision.slice(1)}.
                                                {" "}This repository will be applied when you apply the selected changes.
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <label>
                                        <input type="checkbox" checked={Boolean(selectedRepositories[index])} onChange={(event) => setSelectedRepositories((items) => items.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))} />
                                        <strong>{repo.name}</strong>{repo.description ? ` — ${repo.description}` : ""}
                                        {repo.technologies?.length > 0 && <span> ({repo.technologies.join(", ")})</span>}
                                    </label>
                                )}
                            </div>
                        );
                    })}
                </fieldset>
            )}

            <button type="button" onClick={accept} disabled={actionBusy || Boolean(validationError || invalidReplacement || (isGitHubImport && repositoryDecisions.some((decision) => !decision)))}>
                {actionBusy ? "Applying..." : isGitHubImport ? "Apply decisions and accept selected changes" : "Accept selected changes"}
            </button>{" "}
            <button type="button" onClick={onReject} disabled={actionBusy}>Reject</button>{" "}
            <button type="button" onClick={onCancel} disabled={actionBusy}>Cancel</button>
        </section>
    );
}

export default ProposedChangesReview;
