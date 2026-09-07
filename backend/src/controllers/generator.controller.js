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


module.exports = {

    generatePortfolioZip

};