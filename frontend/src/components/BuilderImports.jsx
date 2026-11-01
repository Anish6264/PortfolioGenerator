import { Link } from "react-router-dom";

function BuilderImports({
    uploadedResumePath,
    uploadedResumeOriginalName,
    resumeFile,
    id,
    uploadingFiles,
    assetAction,
    importBusy,
    canShowResumeAnalysis,
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
        <section id="builder-imports" className="builder-imports" aria-label="Import Your Information">
            <div className="builder-section-heading">
                <span className="builder-import-icon" aria-hidden="true">↥</span>
                <div><p className="builder-eyebrow">Bring your work with you</p><h2>Import your information</h2></div>
            </div>
            <div className="builder-import-grid">
                <section className="builder-import-card builder-resume-card" aria-label="Resume import">
                    <div className="builder-import-card-heading">
                        <span className="builder-import-card-icon" aria-hidden="true">PDF</span>
                        <div><h3>Resume</h3><p>Review every suggestion before applying it.</p></div>
                    </div>
                    <label className="builder-upload-dropzone">
                        <span className="builder-upload-symbol" aria-hidden="true">＋</span>
                        <strong>{uploadedResumePath || resumeFile ? "Choose a different PDF" : "Choose a resume PDF"}</strong>
                        <span>PDF format · maximum 5 MB</span>
                        <input
                            type="file"
                            accept="application/pdf"
                            aria-label="Choose resume PDF"
                            disabled={uploadingFiles || Boolean(assetAction) || importBusy === "resume-analysis"}
                            onChange={onResumeChange}
                        />
                    </label>
                    {uploadedResumePath && !uploadingFiles && (
                        <p className="builder-file-chip" role="status"><span aria-hidden="true">✓</span>{uploadedResumeOriginalName || "Uploaded resume"}</p>
                    )}
                    {resumeFile && <p className="builder-file-chip" role="status"><span aria-hidden="true">PDF</span>Selected: {resumeFile.name}</p>}
                    {uploadingFiles && <p className="builder-progress-message" role="status" aria-busy="true"><span className="builder-spinner" aria-hidden="true" />Uploading file…</p>}
                    {uploadedResumePath && id && (
                        <button className="builder-button builder-button-quiet" type="button" onClick={onResumeRemove} disabled={uploadingFiles || Boolean(assetAction)}>
                            {assetAction === "resume" ? "Removing resume…" : "Remove resume"}
                        </button>
                    )}
                    {canShowResumeAnalysis && (
                        <div className="builder-import-action">
                            <p>AI will prepare suggestions. Your portfolio stays unchanged until you review and apply them.</p>
                            <button className="builder-button builder-button-primary" type="button" onClick={onResumeAnalyze} disabled={!canAnalyzeResume} aria-busy={importBusy === "resume-analysis"}>
                                {importBusy === "resume-analysis" && <span className="builder-spinner" aria-hidden="true" />}
                                {importBusy === "resume-analysis" ? "Analyzing resume..." : "Analyze Resume with AI"}
                            </button>
                        </div>
                    )}
                </section>

                <section className="builder-import-card builder-github-card" aria-label="GitHub import">
                    <div className="builder-import-card-heading">
                        <span className="builder-import-card-icon builder-github-icon" aria-hidden="true">GH</span>
                        <div><h3>GitHub projects</h3><p>Review public repositories before adding them to your portfolio.</p></div>
                    </div>
                    <label className="builder-import-label">
                        <span>GitHub username or profile URL</span>
                        <input
                            value={githubReference}
                            onChange={(event) => onGithubReferenceChange(event.target.value)}
                            maxLength={300}
                        />
                    </label>
                    <p className="builder-credit-note">Import cost <strong>2 credits</strong></p>
                    <button className="builder-button builder-button-primary" type="button" onClick={onGithubImportOpen} disabled={Boolean(importBusy) || reviewPending || !githubReference.trim()}>
                        {importBusy === "github" && <span className="builder-spinner" aria-hidden="true" />}
                        {importBusy === "github" ? "Importing projects…" : "Choose repositories"}
                    </button>
                    {githubImportModal && (
                        <div className="builder-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="github-import-dialog-title">
                            <section className="builder-confirm-dialog">
                                <p className="builder-eyebrow">GitHub import</p>
                                <h3 id="github-import-dialog-title">{githubImportModal === "confirm" ? "Import your repositories?" : "Not enough credits"}</h3>
                                {githubImportModal === "confirm" ? (
                                    <>
                                        <p>Choose public repositories to add to your portfolio. You can review every project before applying it.</p>
                                        <div className="builder-credit-summary"><span>Import cost</span><strong>2 credits</strong><span>Available balance</span><strong>{credits} credits</strong></div>
                                        <p className="builder-dialog-note">The server checks your balance and reserves credits for this import.</p>
                                        <div className="builder-dialog-actions">
                                            <button className="builder-button builder-button-secondary" type="button" onClick={onGithubModalClose}>Cancel</button>
                                            <button className="builder-button builder-button-primary" type="button" onClick={onGithubImport} disabled={Boolean(importBusy)}>{importBusy === "github" ? <><span className="builder-spinner" aria-hidden="true" />Importing…</> : "Continue to repositories"}</button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p>This import needs 2 credits. Your current balance is {githubCreditsAvailable ?? credits}.</p>
                                        <div className="builder-dialog-actions">
                                            <Link className="builder-button builder-button-primary" to="/buy-credits">Buy credits</Link>
                                            <button className="builder-button builder-button-secondary" type="button" onClick={onGithubModalClose}>Cancel</button>
                                        </div>
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
