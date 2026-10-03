import api from "../services/api";

export const downloadPortfolioZip = async (portfolio) => {
    const response = await api.post(
        `/generator/${portfolio._id}`,
        {},
        { responseType: "blob" }
    );

    const blob = new Blob([response.data], { type: "application/zip" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const fileBase = (portfolio.personal?.name || portfolio.personal?.title || "portfolio")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 70)
        .replace(/-+$/g, "") || "portfolio";

    link.href = url;
    link.download = `${fileBase}-portfolio.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};
