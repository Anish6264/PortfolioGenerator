const templateContract = Object.freeze({
    requiredFiles: Object.freeze(["index.html", "style.css", "script.js"]),
    portfolioFields: Object.freeze([
        "personal", "shortIntro", "about", "skills", "education", "experience", "projects", "social", "resume",
        "primaryColor", "secondaryColor", "backgroundColor", "textColor", "fontFamily", "sectionVisibility", "sectionOrder",
        "customSections", "seoTitle", "seoDescription"
    ]),
    metadataFields: Object.freeze([
        "name", "description", "thumbnail", "previewUrl", "category", "templatePath", "isPremium", "creditCost", "isActive"
    ]),
    optionalPortfolioFields: Object.freeze(["education", "experience", "projects", "resume", "personal.profileImage", "customSections"])
});

module.exports = templateContract;
