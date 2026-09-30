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

    const allowedResumeTypes = [
        "application/pdf"
    ];

    const extension = path.extname(file.originalname).toLowerCase();

    const isProfileImage =
        file.fieldname === "profileImage" &&
        (
            (file.mimetype === "image/jpeg" && [".jpg", ".jpeg"].includes(extension)) ||
            (file.mimetype === "image/png" && extension === ".png") ||
            (file.mimetype === "image/webp" && extension === ".webp")
        );
    const isResume =
        file.fieldname === "resume" &&
        allowedResumeTypes.includes(file.mimetype) &&
        extension === ".pdf";

    if (isProfileImage || isResume) {
        cb(null, true);
    } else {
        const error = new Error("Unsupported file type for upload field");
        error.code = "INVALID_FILE_TYPE";
        cb(error);
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
