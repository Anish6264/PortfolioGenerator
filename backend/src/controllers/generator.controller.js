const fs = require("fs");
const path = require("path");

const { ZipArchive } = require("archiver");

const {
    generatePortfolio
} = require("../services/generator.service");

const isValidPortfolioId = (id) => /^[a-f\d]{24}$/i.test(id || "");

const sendGeneratorError = (res, error, operation) => {
    console.error(`${operation} error:`, error);

    if (error.status === 404 || error.statusCode === 404) {
        return res.status(404).json({
            message: "Portfolio not found"
        });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
        return res.status(400).json({
            message: "Invalid portfolio data"
        });
    }

    return res.status(500).json({
        message: "Server error"
    });
};


const generatePortfolioZip = async (req, res) => {

    try {

        if (!isValidPortfolioId(req.params.portfolioId)) {
            return res.status(400).json({
                message: "Invalid portfolio ID"
            });
        }

        const result = await generatePortfolio(
            req.params.portfolioId,
            req.user.id
        );


        // ------------------------------------------
        // ZIP filename
        // ------------------------------------------

        const zipFileName =
            `${result.template.name
                .toLowerCase()
                .replace(/\s+/g, "-")}.zip`;


        res.attachment(zipFileName);


        // ------------------------------------------
        // Create ZIP
        // ------------------------------------------

        const archive = new ZipArchive({

            zlib: {
                level: 9
            }

        });


        archive.on("error", (error) => {
            console.error("Generate portfolio archive error:", error);

            if (!res.headersSent) {
                res.status(500).json({
                    message: "Server error"
                });
            } else {
                res.destroy();
            }
        });


        archive.pipe(res);


        // ------------------------------------------
        // Portfolio files
        // ------------------------------------------

        archive.append(
            result.html,
            {
                name: "index.html"
            }
        );


        archive.append(
            result.css,
            {
                name: "style.css"
            }
        );


        archive.append(
            result.js,
            {
                name: "script.js"
            }
        );


        // ------------------------------------------
        // Profile Image
        // ------------------------------------------

        if (
            result.profileImagePath
        ) {

            archive.file(
                result.profileImagePath,
                {
                    name:
                        `assets/profile-image${
                            path.extname(
                                result.profileImagePath
                            )
                        }`
                }
            );

        }


        // ------------------------------------------
        // Resume
        // ------------------------------------------

        if (
            result.resumePath
        ) {

            archive.file(
                result.resumePath,
                {
                    name: "assets/resume.pdf"
                }
            );

        }


        // ------------------------------------------
        // Finalize ZIP
        // ------------------------------------------

        await archive.finalize();

    } catch (error) {

        if (!res.headersSent) {
            return sendGeneratorError(res, error, "Generate portfolio");
        }

        console.error("Generate portfolio error:", error);
        res.destroy();

    }

};


const previewPortfolio = async (req, res) => {
    try {

        if (!isValidPortfolioId(req.params.portfolioId)) {
            return res.status(400).json({
                message: "Invalid portfolio ID"
            });
        }

        const result = await generatePortfolio(
            req.params.portfolioId,
            req.user.id
        );

        let html = result.html;

        // -----------------------------------------
        // Add CSS directly inside HTML
        // -----------------------------------------

        html = html.replace(
            '<link rel="stylesheet" href="style.css">',
            `<style>
                ${result.css}
            </style>`
        );

        // -----------------------------------------
        // Add JavaScript directly inside HTML
        // -----------------------------------------

        html = html.replace(
            '<script src="script.js"></script>',
            `<script>
                ${result.js}
            </script>`
        );

        // -----------------------------------------
        // Convert profile image to Base64
        // -----------------------------------------

        if (result.profileImagePath) {

            const imageBuffer = fs.readFileSync(
                result.profileImagePath
            );

            const extension =
                path.extname(
                    result.profileImagePath
                ).toLowerCase();

            let mimeType = "image/jpeg";

            if (extension === ".png") {
                mimeType = "image/png";
            }

            if (extension === ".webp") {
                mimeType = "image/webp";
            }

            const base64Image =
                imageBuffer.toString("base64");

            const imageDataUrl =
                `data:${mimeType};base64,${base64Image}`;

            html = html.replace(
                /assets\/profile-image\.[a-zA-Z0-9]+/g,
                imageDataUrl
            );
        }

        // -----------------------------------------
        // Return generated HTML
        // -----------------------------------------

        res.status(200).json({
            html
        });

    } catch (error) {

        if (!res.headersSent) {
            return sendGeneratorError(res, error, "Preview portfolio");
        }

        console.error("Preview portfolio error:", error);
        res.destroy();
    }
};


module.exports = {
    generatePortfolioZip,
    previewPortfolio
};
