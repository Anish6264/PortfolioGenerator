import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

let vite;
let BuilderImports;
let ProposedChangesReview;
let BuyCredits;
let CreditsBilling;
let Dashboard;
let PortfolioPreview;
let PublicPortfolio;
let AdminLayout;
let AuthContext;
let mergeProposedPortfolioData;

before(async () => {
    vite = await createServer({
        configFile: "./vite.config.js",
        server: { middlewareMode: true, hmr: false },
        appType: "custom"
    });
    ({ default: BuilderImports } = await vite.ssrLoadModule("/src/components/BuilderImports.jsx"));
    ({ default: ProposedChangesReview } = await vite.ssrLoadModule("/src/components/ProposedChangesReview.jsx"));
    ({ default: BuyCredits } = await vite.ssrLoadModule("/src/pages/BuyCredits.jsx"));
    ({ default: CreditsBilling } = await vite.ssrLoadModule("/src/pages/CreditsBilling.jsx"));
    ({ default: Dashboard } = await vite.ssrLoadModule("/src/pages/Dashboard.jsx"));
    ({ default: PortfolioPreview } = await vite.ssrLoadModule("/src/pages/PortfolioPreview.jsx"));
    ({ default: PublicPortfolio } = await vite.ssrLoadModule("/src/pages/PublicPortfolio.jsx"));
    ({ default: AdminLayout } = await vite.ssrLoadModule("/src/components/AdminLayout.jsx"));
    ({ default: AuthContext } = await vite.ssrLoadModule("/src/context/AuthContextValue.js"));
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

const renderAccountPage = (Component, initialEntry) => renderToStaticMarkup(React.createElement(
    AuthContext.Provider,
    { value: { user: { name: "Test User", credits: 24 }, refreshUser: async () => ({ credits: 24 }), logout: () => {} } },
    React.createElement(MemoryRouter, { initialEntries: [initialEntry] }, React.createElement(Component))
));

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

test("GitHub import confirmation clearly presents cost and available balance", () => {
    const markup = renderImports({
        githubReference: "octocat",
        githubImportModal: "confirm",
        credits: 8
    });
    assert.match(markup, /role="dialog" aria-modal="true"/);
    assert.match(markup, /Import your repositories\?/);
    assert.match(markup, /2 credits/);
    assert.match(markup, /8 credits/);
    assert.match(markup, /Continue to repositories/);
});

test("proposed changes review presents selected fields and explicit apply, reject and cancel actions", () => {
    const markup = renderToStaticMarkup(React.createElement(
        ProposedChangesReview,
        {
            proposal: { source: "AI Resume Analysis", data: { shortIntro: "A product designer." } },
            currentData: { shortIntro: "", about: "", personal: {}, social: {}, skills: [], education: [], experience: [], projects: [] },
            onAccept: () => {},
            onReject: () => {},
            onCancel: () => {}
        }
    ));
    assert.match(markup, /Review before applying/);
    assert.match(markup, /A product designer\./);
    assert.match(markup, /Accept selected changes/);
    assert.match(markup, /Reject proposal/);
    assert.match(markup, />Cancel</);
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

test("credit purchase page lists the existing one-time packs and confirms verification policy", () => {
    const markup = renderAccountPage(BuyCredits, "/buy-credits");
    assert.match(markup, /Current balance/);
    assert.match(markup, /10/);
    assert.match(markup, /30/);
    assert.match(markup, /75/);
    assert.match(markup, /Credits are added only after payment verification/);
});

test("billing, dashboard, private preview and public portfolio render their loading states accessibly", () => {
    assert.match(renderAccountPage(CreditsBilling, "/credits"), /Loading credit activity/);
    assert.match(renderAccountPage(Dashboard, "/dashboard"), /Loading your workspace/);
    assert.match(renderAccountPage(PortfolioPreview, "/portfolio/0123456789abcdef01234567/preview"), /Preparing your preview/);
    assert.match(renderAccountPage(PublicPortfolio, "/p/sample"), /Loading portfolio/);
});

test("admin shell exposes responsive workspace navigation and marks the active section", () => {
    const markup = renderToStaticMarkup(React.createElement(
        AuthContext.Provider,
        { value: { user: { name: "Admin User" }, logout: () => {} } },
        React.createElement(MemoryRouter, { initialEntries: ["/admin/users/abc"] },
            React.createElement(AdminLayout, null, React.createElement("main", null, "Users")))
    ));
    assert.match(markup, /aria-label="Admin navigation"/);
    assert.match(markup, /aria-current="page"/);
    assert.match(markup, /Users/);
    assert.match(markup, /Credit activity/);
    assert.match(markup, /Log out/);
    assert.match(markup, /Admin User/);
});
