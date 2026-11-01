import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

let vite;
let BuilderImports;
let mergeProposedPortfolioData;

before(async () => {
    vite = await createServer({
        configFile: "./vite.config.js",
        server: { middlewareMode: true, hmr: false },
        appType: "custom"
    });
    ({ default: BuilderImports } = await vite.ssrLoadModule("/src/components/BuilderImports.jsx"));
    ({ mergeProposedPortfolioData } = await vite.ssrLoadModule("/src/utils/proposedPortfolioData.js"));
});

after(async () => {
    await vite?.close();
});

const renderImports = (overrides = {}) => {
    const props = {
        uploadedResumePath: "",
        uploadedResumeOriginalName: "",
        resumeFile: null,
        id: undefined,
        uploadingFiles: false,
        assetAction: "",
        importBusy: "",
        canShowResumeAnalysis: false,
        canAnalyzeResume: false,
        onResumeChange: () => {},
        onResumeRemove: () => {},
        onResumeAnalyze: () => {},
        githubReference: "",
        onGithubReferenceChange: () => {},
        onGithubImportOpen: () => {},
        githubImportModal: "",
        githubCreditsAvailable: null,
        reviewPending: false,
        credits: 0,
        onGithubModalClose: () => {},
        onGithubImport: () => {},
        ...overrides
    };
    return renderToStaticMarkup(React.createElement(
        MemoryRouter,
        null,
        React.createElement(BuilderImports, props)
    ));
};

test("new portfolio shows Analyze after a valid resume file is selected", () => {
    const markup = renderImports({
        resumeFile: { name: "resume.pdf" },
        canShowResumeAnalysis: true,
        canAnalyzeResume: true
    });
    assert.match(markup, /Selected: resume\.pdf/);
    assert.match(markup, /Analyze Resume with AI/);
    assert.doesNotMatch(markup, /Analyze Resume with AI<\/button disabled/);
});

test("resume analysis loading state disables upload and analyze controls", () => {
    const markup = renderImports({
        resumeFile: { name: "resume.pdf" },
        importBusy: "resume-analysis",
        canShowResumeAnalysis: true,
        canAnalyzeResume: false
    });
    assert.match(markup, /Analyzing resume\.\.\./);
    assert.match(markup, /type="file"[^>]*disabled/);
    assert.match(markup, /Analyzing resume\.\.\.<\/button>/);
});

test("existing portfolio still displays analysis for a saved resume", () => {
    const markup = renderImports({
        uploadedResumePath: "uploads/123-456.pdf",
        uploadedResumeOriginalName: "resume.pdf",
        id: "portfolio-id",
        canShowResumeAnalysis: true,
        canAnalyzeResume: true
    });
    assert.match(markup, /resume\.pdf/);
    assert.match(markup, /Analyze Resume with AI/);
});

test("proposal merging preserves unselected data and does not mutate current Builder data", () => {
    const current = {
        personal: { name: "Existing Name", email: "existing@example.test" },
        social: { github: "" },
        skills: ["Existing Skill"],
        education: [],
        experience: [],
        projects: []
    };
    const before = structuredClone(current);
    const merged = mergeProposedPortfolioData(
        current,
        { personal: { name: "Suggested Name" }, skills: ["Suggested Skill"] },
        { "personal.name": false },
        {},
        {},
        {}
    );
    assert.deepEqual(current, before);
    assert.equal(merged.personal.name, "Existing Name");
    assert.equal(merged.personal.email, "existing@example.test");
    assert.deepEqual(merged.skills, ["Existing Skill", "Suggested Skill"]);
});
