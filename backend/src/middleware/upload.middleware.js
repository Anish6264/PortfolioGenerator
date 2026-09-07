const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDirectory = path.join(
    __dirname,
    "../uploads"
);

if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, {
        recursive: true
    });
}

const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, uploadDirectory);
    },

    filename: (req, file, cb) => {

        const extension =
            path.extname(file.originalname);

        const filename =
            `${Date.now()}-${Math.round(
                Math.random() * 1E9
            )}${extension}`;

        cb(null, filename);
    }
});


const fileFilter = (req, file, cb) => {

    const allowedImageTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    const allowedResumeTypes = [
        "application/pdf"
    ];

    if (
        allowedImageTypes.includes(file.mimetype) ||
        allowedResumeTypes.includes(file.mimetype)
    ) {
        cb(null, true);
    } else {
        cb(
            new Error(
                "Only JPG, PNG, WEBP images and PDF files are allowed"
            )
        );
    }
};


const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});


module.exports = upload;