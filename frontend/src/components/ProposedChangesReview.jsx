import { useState } from "react";
import {
    mergeProposedPortfolioData,
    validateProposedPortfolioData
} from "../utils/proposedPortfolioData";

const scalarGroups = [
    ["personal", "Personal information"],
    ["social", "Social links"]
];
const arrayFields = ["skills", "education", "experience", "projects"];
const displayValue = (value) => value === undefined || value === null || value === "" ? "(empty)" : String(value);

function ProposedChangesReview({ proposal, currentData, onAccept, onReject, onCancel }) {
    const data = proposal.data || {};
    const validationError = validateProposedPortfolioData(data);
    const [selectedFields, setSelectedFields] = useState({});
    const [selectedArrays, setSelectedArrays] = useState({});
    const [selectedReplacements, setSelectedReplacements] = useState({});
    const repositories = Array.isArray(proposal.repositories) ? proposal.repositories : [];
    const [selectedRepositories, setSelectedRepositories] = useState(() => repositories.map((repo) => repo.selected !== false));
    const replacements = proposal.replacements || {};
    const invalidReplacement = Object.entries(replacements).some(([path, value]) => {
        const match = /^(experience|projects)\.(\d+)\.description$/.exec(path);
        return !match || Number(match[2]) >= (currentData[match[1]] || []).length ||
            typeof value !== "string" || value.length > 2000;
    });

    const setFieldSelected = (key, checked) => setSelectedFields((current) => ({ ...current, [key]: checked }));
    const setArraySelected = (field, index, checked) => setSelectedArrays((current) => ({
        ...current,
        [field]: { ...(current[field] || {}), [index]: checked }
    }));

    const accept = () => onAccept(mergeProposedPortfolioData(
        currentData,
        data,
        selectedFields,
        selectedArrays,
        replacements,
        selectedReplacements,
        repositories.filter((_, index) => selectedRepositories[index]).map((repo) => ({
            title: repo.name,
            description: repo.description || "",
            technologies: Array.isArray(repo.technologies) ? repo.technologies : [],
            githubUrl: repo.githubUrl || "",
            liveUrl: repo.liveUrl || ""
        }))
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

            {arrayFields.filter((field) => Array.isArray(data[field])).map((field) => (
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
                    <legend>GitHub repositories to add as projects</legend>
                    <button type="button" onClick={() => selectAllRepositories(true)}>Select All</button>{" "}
                    <button type="button" onClick={() => selectAllRepositories(false)}>Clear All</button>
                    {repositories.map((repo, index) => (
                        <label key={`${repo.githubUrl}-${index}`}>
                            <input type="checkbox" checked={Boolean(selectedRepositories[index])} onChange={(event) => setSelectedRepositories((items) => items.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))} />
                            <strong>{repo.name}</strong>{repo.description ? ` — ${repo.description}` : ""}
                            {repo.technologies?.length > 0 && <span> ({repo.technologies.join(", ")})</span>}
                        </label>
                    ))}
                </fieldset>
            )}

            <button type="button" onClick={accept} disabled={Boolean(validationError || invalidReplacement)}>Accept selected changes</button>{" "}
            <button type="button" onClick={onReject}>Reject</button>{" "}
            <button type="button" onClick={onCancel}>Cancel</button>
        </section>
    );
}

export default ProposedChangesReview;
