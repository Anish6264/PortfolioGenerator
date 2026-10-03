const MAX_SLUG_LENGTH = 80;
const MAX_ATTEMPTS = 100;

const slugify = (value) => {
    const slug = String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, MAX_SLUG_LENGTH)
        .replace(/-+$/g, "");

    return slug || "portfolio";
};

const isSlugConflict = (error) =>
    error?.code === 11000 && (
        error.keyPattern?.slug ||
        error.keyValue?.slug ||
        String(error.message || "").includes("slug")
    );

const getCandidate = (baseSlug, attempt) => {
    const suffix = attempt === 1 ? "" : `-${attempt}`;
    const base = baseSlug
        .slice(0, MAX_SLUG_LENGTH - suffix.length)
        .replace(/-+$/g, "");

    return `${base}${suffix}`;
};

const createPortfolioWithUniqueSlug = async (Portfolio, data, name) => {
    const baseSlug = slugify(name);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
            return await Portfolio.create({
                ...data,
                slug: getCandidate(baseSlug, attempt)
            });
        } catch (error) {
            if (!isSlugConflict(error)) {
                throw error;
            }
        }
    }

    const error = new Error("Unable to generate a unique portfolio slug");
    error.code = 11000;
    error.keyPattern = { slug: 1 };
    throw error;
};

const updatePortfolioWithUniqueSlug = async (Portfolio, filter, updates, name) => {
    const baseSlug = slugify(name);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
            return await Portfolio.findOneAndUpdate(
                filter,
                { ...updates, slug: getCandidate(baseSlug, attempt) },
                { returnDocument: "after", runValidators: true }
            );
        } catch (error) {
            if (!isSlugConflict(error)) {
                throw error;
            }
        }
    }

    const error = new Error("Unable to generate a unique portfolio slug");
    error.code = 11000;
    error.keyPattern = { slug: 1 };
    throw error;
};

module.exports = {
    slugify,
    createPortfolioWithUniqueSlug,
    updatePortfolioWithUniqueSlug
};
