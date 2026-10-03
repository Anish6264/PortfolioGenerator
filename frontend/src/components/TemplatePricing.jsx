import { getTemplateGenerationCost } from "../utils/templatePricing";

function TemplatePricing({ template, showBalance, credits = 0 }) {
    if (!template) return null;
    const generationCost = getTemplateGenerationCost(template);

    return (
        <div aria-label="Template tier and first-download credit cost">
            <p>{template.isPremium === true ? "Premium" : "Standard"}</p>
            <p>{generationCost === null
                ? "Generation cost unavailable"
                : `${generationCost} credit${generationCost === 1 ? "" : "s"} on first download`}</p>
            {showBalance && <p>Your credits: {credits}</p>}
        </div>
    );
}

export default TemplatePricing;
