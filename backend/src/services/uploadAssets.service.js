const fs = require("fs/promises");
const path = require("path");

const uploadDirectory = path.resolve(__dirname, "../uploads");
const extensionsByKind = {
    resume: ["pdf"],
    profileImage: ["jpg", "jpeg", "png", "webp"]
};

const sanitizeOriginalFilename = (filename, fallback) => {
    if (typeof filename !== "string") return fallback;
    const basename = path.posix.basename(filename.replaceAll("\\", "/"));
    const safeName = basename.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 255);
    return safeName || fallback;
};

const hasSupportedFileSignature = async (filePath, kind) => {
    let handle;
    try {
        handle = await fs.open(filePath, "r");
        const header = Buffer.alloc(12);
        const { bytesRead } = await handle.read(header, 0, header.length, 0);
        const bytes = header.subarray(0, bytesRead);
        if (kind === "resume") return bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-";
        if (kind === "profileImage") {
            return (
                (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
                (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
                (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP")
            );
        }
        return false;
    } catch {
        return false;
    } finally {
        await handle?.close().catch(() => {});
    }
};

const resolveManagedUploadPath = (storedReference, kind) => {
    if (typeof storedReference !== "string" || !storedReference.trim()) return null;
    const normalized = storedReference.replaceAll("\\", "/");
    const match = /^uploads\/(\d+-\d+\.([a-z\d]+))$/i.exec(normalized);
    if (!match || !extensionsByKind[kind]?.includes(match[2].toLowerCase())) {
        const error = new Error("Stored upload reference is not managed by the upload service");
        error.code = "UNSAFE_UPLOAD_REFERENCE";
        throw error;
    }
    const candidate = path.resolve(uploadDirectory, match[1]);
    if (path.dirname(candidate) !== uploadDirectory) {
        const error = new Error("Stored upload reference is outside the upload directory");
        error.code = "UNSAFE_UPLOAD_REFERENCE";
        throw error;
    }
    return candidate;
};

const removeManagedUpload = async (storedReference, kind) => {
    const candidate = resolveManagedUploadPath(storedReference, kind);
    if (!candidate) return false;

    let stats;
    try {
        stats = await fs.lstat(candidate);
    } catch (error) {
        if (error.code === "ENOENT") return false;
        throw error;
    }
    if (!stats.isFile() || stats.isSymbolicLink()) {
        const error = new Error("Stored upload is not a regular managed file");
        error.code = "UNSAFE_UPLOAD_REFERENCE";
        throw error;
    }

    const realPath = await fs.realpath(candidate);
    const relative = path.relative(uploadDirectory, realPath);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
        const error = new Error("Stored upload resolved outside the upload directory");
        error.code = "UNSAFE_UPLOAD_REFERENCE";
        throw error;
    }
    await fs.unlink(candidate);
    return true;
};

const getManagedUploadPath = async (storedReference, kind) => {
    const candidate = resolveManagedUploadPath(storedReference, kind);
    if (!candidate) return null;
    let linkStats;
    try {
        linkStats = await fs.lstat(candidate);
    } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
    }
    if (!linkStats.isFile() || linkStats.isSymbolicLink()) return null;
    const realPath = await fs.realpath(candidate);
    const relative = path.relative(uploadDirectory, realPath);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
    const stats = await fs.stat(realPath);
    return stats.isFile() ? realPath : null;
};

module.exports = { sanitizeOriginalFilename, hasSupportedFileSignature, removeManagedUpload, getManagedUploadPath };
