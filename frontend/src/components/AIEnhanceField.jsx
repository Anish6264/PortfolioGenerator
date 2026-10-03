import { useState } from "react";
import api from "../services/api";

function AIEnhanceField({ field, text, onApply }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [review, setReview] = useState(null);

    if (typeof text !== "string" || !text.trim()) return null;

    const requestEnhancement = async () => {
        setLoading(true);
        setError("");
        setReview(null);
        try {
            const response = await api.post("/ai/enhance", { field, text });
            const enhancedText = response.data?.enhancedText;
            if (response.data?.success !== true || typeof enhancedText !== "string" || !enhancedText.trim()) {
                throw new Error("AI returned an invalid enhancement. Your text was not changed.");
            }
            setReview({ original: text, enhanced: enhancedText });
        } catch (requestError) {
            setError(requestError.response?.data?.message || requestError.message || "AI Enhance is unavailable right now.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ai-enhance-field">
            <button type="button" onClick={requestEnhancement} disabled={loading}>
                {loading ? "Enhancing..." : "✨ Enhance with AI"}
            </button>
            {error && <p role="alert">{error}</p>}
            {review && (
                <section aria-label="Review enhanced text">
                    <h4>Review enhanced text</h4>
                    <p><strong>Original</strong></p>
                    <p className="ai-enhance-preview">{review.original}</p>
                    <p><strong>Enhanced</strong></p>
                    <p className="ai-enhance-preview">{review.enhanced}</p>
                    <button
                        type="button"
                        onClick={() => {
                            onApply(review.enhanced);
                            setReview(null);
                        }}
                    >
                        Use Enhanced Version
                    </button>{" "}
                    <button type="button" onClick={() => setReview(null)}>Cancel</button>
                </section>
            )}
        </div>
    );
}

export default AIEnhanceField;
