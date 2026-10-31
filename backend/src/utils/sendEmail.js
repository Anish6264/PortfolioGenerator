const nodemailer = require("nodemailer");

let transporter;

const getTransporter = () => {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = Number(process.env.SMTP_PORT);
    if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("SMTP service is not configured");
    }
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host,
            port,
            secure: process.env.SMTP_SECURE === "true",
            ...(user && pass ? { auth: { user, pass } } : {})
        });
    }
    return transporter;
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));

const sendEmail = async ({ to, subject, heading, message, detail, actionUrl }) => {
    const safeHeading = escapeHtml(heading);
    const safeMessage = escapeHtml(message);
    const safeDetail = escapeHtml(detail);
    const action = actionUrl
        ? `<p style="margin:24px 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#7547e8;color:#fff;text-decoration:none;font-weight:700">Reset password</a></p><p style="font-size:13px;word-break:break-word">If the button does not work, copy this link: ${escapeHtml(actionUrl)}</p>`
        : `<div style="margin:24px 0;padding:18px;background:#f4f1ff;border-radius:10px;text-align:center;font-size:20px;font-weight:700;word-break:break-word">${safeDetail}</div>`;
    const html = `<div style="margin:0;padding:32px 16px;background:#f6f7fb;font-family:Arial,sans-serif;color:#202033"><div style="max-width:560px;margin:auto;padding:32px;background:#fff;border:1px solid #e8e8ef;border-radius:16px"><div style="font-size:13px;font-weight:700;letter-spacing:.12em;color:#6c49e8">PORTFOLIO GENERATOR</div><h1 style="font-size:24px;margin:24px 0 12px">${safeHeading}</h1><p style="font-size:15px;line-height:1.6">${safeMessage}</p>${action}<p style="font-size:13px;color:#6b6877;line-height:1.6">If you did not request this, you can ignore this email.</p></div></div>`;
    try {
        await getTransporter().sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to,
            subject,
            html
        });
    } catch (error) {
        const code = typeof error?.code === "string" && /^[A-Z0-9_]{1,32}$/.test(error.code) ? error.code : "UNKNOWN";
        const command = typeof error?.command === "string" ? error.command.match(/^(AUTH|CONN|EHLO|HELO|MAIL|RCPT|DATA|STARTTLS|QUIT)/)?.[1] : undefined;
        const responseCode = Number.isInteger(error?.responseCode) ? error.responseCode : undefined;
        console.error("SMTP delivery failed:", { name: error?.name || "Error", code, command, responseCode });
        throw error;
    }
};

module.exports = { sendEmail };
