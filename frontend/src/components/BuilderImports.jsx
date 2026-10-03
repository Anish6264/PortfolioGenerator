import { Link } from "react-router-dom";

function BuilderImports({
    uploadedResumePath,
    uploadedResumeOriginalName,
    resumeFile,
    id,
    uploadingFiles,
    assetAction,
    importBusy,
    hasUploadedResume,
    canAnalyzeResume,
    onResumeChange,
    onResumeRemove,
    onResumeAnalyze,
    githubReference,
    onGithubReferenceChange,
    onGithubImportOpen,
    githubImportModal,
    githubCreditsAvailable,
    reviewPending,
    credits,
    onGithubModalClose,
    onGithubImport
}) {
    return (
        <section aria-label="Import Your Information">
            <h2>Import Your Information</h2>
            <div>
                <section aria-label="Resume import">
                    <h3>Resume</h3>
                    <p>Upload your resume and let AI extract your portfolio information.</p>
                    <label>
                        {uploadedResumePath ? "Replace" : "Upload Resume"}
                        <input
                            type="file"
                            accept="application/pdf"
                            disabled={uploadingFiles || Boolean(assetAction)}
                            onChange={onResumeChange}
                        />
                    </label>
                    {uploadedResumePath && !uploadingFiles && (
                        <p role="status">{uploadedResumeOriginalName || "Uploaded resume"}</p>
                    )}
                    {resumeFile && <p role="status">Selected: {resumeFile.name}</p>}
                    {uploadingFiles && <p role="status">Uploading file...</p>}
                    {uploadedResumePath && id && (
                        <button type="button" onClick={onResumeRemove} disabled={uploadingFiles || Boolean(assetAction)}>
                            {assetAction === "resume" ? "Removing Resume..." : "Remove"}
                        </button>
                    )}
                    {hasUploadedResume && (
                        <div>
                            <p>Analyze your resume with AI. Nothing changes until you review and apply the proposal.</p>
                            <button type="button" onClick={onResumeAnalyze} disabled={!canAnalyzeResume}>
                                {importBusy === "resume-analysis" ? "Analyzing resume..." : "Analyze Resume with AI"}
                            </button>
                        </div>
                    )}
                    <p>PDF only. Maximum file size: 5 MB.</p>
                </section>

                <section aria-label="GitHub import">
                    <h3>GitHub</h3>
                    <p>Import public repositories into your portfolio.</p>
                    <label>
                        GitHub username or profile URL{" "}
                        <input
                            value={githubReference}
                            onChange={(event) => onGithubReferenceChange(event.target.value)}
                            maxLength={300}
                        />
                    </label>
                    <p>Cost: 2 credits</p>
                    <button type="button" onClick={onGithubImportOpen} disabled={Boolean(importBusy) || reviewPending || !githubReference.trim()}>
                        {importBusy === "github" ? "Importing GitHub projects..." : "Import GitHub Projects"}
                    </button>
                    {githubImportModal && (
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="github-import-dialog-title"
                            style={{
                                position: "fixed",
                                inset: 0,
                                zIndex: 1000,
                                display: "grid",
                                placeItems: "center",
                                padding: "1rem",
                                background: "rgba(0, 0, 0, 0.55)"
                            }}
                        >
                            <section style={{ maxWidth: "28rem", width: "100%", padding: "1.5rem", background: "var(--bg)", border: "1px solid var(--border)" }}>
                                <h3 id="github-import-dialog-title">
                                    {githubImportModal === "confirm" ? "GitHub Project Import" : "Not enough credits"}
                                </h3>
                                {githubImportModal === "confirm" ? (
                                    <>
                                        <p>Import your public GitHub projects for review.</p>
                                        <p>Cost: 2 credits</p>
                                        <p>Your credits: {credits}</p>
                                        <p>The server verifies your balance and reserves the import cost.</p>
                                        <button type="button" onClick={onGithubModalClose}>Cancel</button>{" "}
                                        <button type="button" onClick={onGithubImport} disabled={Boolean(importBusy)}>Import GitHub Projects</button>
                                    </>
                                ) : (
                                    <>
                                        <p>GitHub Project Import requires 2 credits.</p>
                                        <p>Your credits: {githubCreditsAvailable ?? credits}</p>
                                        <Link to="/buy-credits">Buy Credits</Link>{" "}
                                        <button type="button" onClick={onGithubModalClose}>Cancel</button>
                                    </>
                                )}
                            </section>
                        </div>
                    )}
                </section>
            </div>
        </section>
    );
}

export default BuilderImports;
