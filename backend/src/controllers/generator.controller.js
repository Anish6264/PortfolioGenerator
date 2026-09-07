const archiver = require("archiver");

const {
    generatePortfolio
} = require("../services/generator.service");

const generatePortfolioZip = async (req, res) => {
    try {

        const result = await generatePortfolio(
            req.params.portfolioId,
            req.user.id
        );

        res.attachment(
            `${result.template.name
                .toLowerCase()
                .replace(/\s+/g, "-")}.zip`
        );

        const archive = archiver("zip", {
            zlib: {
                level: 9
            }
        });

        archive.on("error", (error) => {
            throw error;
        });

        archive.pipe(res);

        archive.append(result.html, {
            name: "index.html"
        });

        archive.append(result.css, {
            name: "style.css"
        });

        archive.append(result.js, {
            name: "script.js"
        });

        await archive.finalize();

    } catch (error) {

        console.error(
            "Generate portfolio error:",
            error.message
        );

        if (!res.headersSent) {
            return res.status(500).json({
                message: error.message || "Server error"
            });
        }
    }
};

module.exports = {
    generatePortfolioZip
};