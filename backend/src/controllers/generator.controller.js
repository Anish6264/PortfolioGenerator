const fs = require("fs");
const path = require("path");

const { ZipArchive } = require("archiver");

const {
    generatePortfolio
} = require("../services/generator.service");


const generatePortfolioZip = async (req, res) => {

    try {

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

            throw error;

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

        console.error(
            "Generate portfolio error:",
            error.message
        );


        if (!res.headersSent) {

            return res.status(500).json({

                message:
                    error.message ||
                    "Server error"

            });

        }

    }

};


const previewPortfolio = async (req, res) => {
    try {

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

        console.error(
            "Preview portfolio error:",
            error.message
        );

        if (!res.headersSent) {

            return res.status(500).json({
                message:
                    error.message ||
                    "Failed to preview portfolio"
            });

        }
    }
};


module.exports = {
    generatePortfolioZip,
    previewPortfolio
};