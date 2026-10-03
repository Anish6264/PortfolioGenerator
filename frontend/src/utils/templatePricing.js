export const getTemplateGenerationCost = (template) => {
    if (template && template.isPremium !== true) return 1;
    const configuredCost = template?.creditCost;
    return Number.isInteger(configuredCost) && configuredCost >= 1 ? configuredCost : null;
};
