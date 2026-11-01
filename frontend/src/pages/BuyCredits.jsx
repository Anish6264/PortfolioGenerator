import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
import "./BuyCredits.css";

const CREDIT_PACKS = [
    { id: "credits_10", credits: 10, price: "₹49" },
    { id: "credits_30", credits: 30, price: "₹99" },
    { id: "credits_75", credits: 75, price: "₹199" }
];

let checkoutScriptPromise;

const loadRazorpayCheckout = () => {
    if (window.Razorpay) return Promise.resolve();
    if (checkoutScriptPromise) return checkoutScriptPromise;

    checkoutScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => {
            if (window.Razorpay) {
                resolve();
            } else {
                checkoutScriptPromise = null;
                reject(new Error("Razorpay Checkout could not be initialized."));
            }
        };
        script.onerror = () => {
            checkoutScriptPromise = null;
            reject(new Error("Could not load Razorpay Checkout. Check your connection and try again."));
        };
        document.head.appendChild(script);
    });

    return checkoutScriptPromise;
};

function BuyCredits() {
    const { user, refreshUser } = useAuth();
    const location = useLocation();
    const returnToBilling = location.state?.from === "/credits";
    const [processingPack, setProcessingPack] = useState(null);
    const [stage, setStage] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const paymentLock = useRef(false);
    const verificationStarted = useRef(false);

    const handleBuy = async (pack) => {
        if (paymentLock.current) return;

        paymentLock.current = true;
        verificationStarted.current = false;
        setProcessingPack(pack.id);
        setStage("Preparing checkout...");
        setError("");
        setMessage("");

        let checkoutOpened = false;
        const finish = (kind, text) => {
            if (!paymentLock.current) return;
            paymentLock.current = false;
            setProcessingPack(null);
            setStage("");
            if (kind === "error") setError(text);
            if (kind === "message") setMessage(text);
        };

        try {
            await loadRazorpayCheckout();

            const orderResponse = await api.post("/payments/orders", {
                packId: pack.id
            });
            const order = orderResponse.data;

            if (!order?.keyId || !order?.orderId || !order?.amount || !order?.currency) {
                throw new Error("The server returned an incomplete payment order.");
            }

            const checkout = new window.Razorpay({
                key: order.keyId,
                amount: order.amount,
                currency: order.currency,
                order_id: order.orderId,
                name: "Portfolio Generator",
                description: `${pack.credits} portfolio credits`,
                prefill: {
                    name: user?.name || "",
                    email: user?.email || ""
                },
                handler: async (payment) => {
                    if (!paymentLock.current || verificationStarted.current) return;
                    verificationStarted.current = true;
                    setStage("Verifying payment...");

                    try {
                        const verification = await api.post("/payments/verify", {
                            razorpay_order_id: payment.razorpay_order_id,
                            razorpay_payment_id: payment.razorpay_payment_id,
                            razorpay_signature: payment.razorpay_signature
                        });

                        if (verification.data?.status !== "paid") {
                            throw new Error("Payment could not be confirmed. Please contact support if you were charged.");
                        }

                        try {
                            const updatedUser = await refreshUser();
                            finish("message", `Payment verified. Your balance is now ${updatedUser.credits} credits.`);
                        } catch {
                            finish("message", "Payment verified and credits were added. Reload the page to refresh your displayed balance.");
                        }
                    } catch (verificationError) {
                        finish(
                            "error",
                            verificationError.response?.data?.message ||
                            verificationError.message ||
                            "Payment verification failed. If you were charged, contact support before retrying."
                        );
                    }
                },
                modal: {
                    ondismiss: () => {
                        if (!verificationStarted.current) {
                            finish("error", "Checkout was closed. No credits were added.");
                        }
                    }
                }
            });

            checkout.on("payment.failed", () => {
                finish("error", "Payment was not completed. No credits were added.");
            });

            checkoutOpened = true;
            checkout.open();
        } catch (checkoutError) {
            finish(
                "error",
                checkoutError.response?.data?.message ||
                checkoutError.message ||
                "Unable to start checkout. Please try again."
            );
        } finally {
            if (!checkoutOpened) {
                paymentLock.current = false;
                setProcessingPack(null);
                setStage("");
            }
        }
    };

    return (
        <main className="buy-credits-page">
            <header className="buy-credits-header">
                <p><Link to={returnToBilling ? "/credits" : "/dashboard"}>{returnToBilling ? "← Back to Credits & Billing" : "← Back to Dashboard"}</Link></p>
                <p className="buy-credits-eyebrow">Keep building</p>
                <h1>Choose your credit pack</h1>
                <p>Credits are used when you download a portfolio for the first time. Editing and later downloads are free.</p>
                <div className="buy-credits-balance"><span>Current balance</span><strong>{user?.credits ?? 0}<small> credits</small></strong></div>
            </header>

            <section className="credit-pack-list" aria-label="Credit packs">
                {CREDIT_PACKS.map((pack) => (
                    <article className={`credit-pack ${processingPack === pack.id ? "is-processing" : ""}`} key={pack.id} aria-busy={processingPack === pack.id}>
                        {pack.credits === 30 && <span className="credit-pack-badge">Popular</span>}
                        <p className="credit-pack-kicker">Credit pack</p>
                        <h2>{pack.credits}<small> credits</small></h2>
                        <p className="credit-pack-price">{pack.price}</p>
                        <p className="credit-pack-description">One-time purchase · no subscription</p>
                        <button
                            type="button"
                            onClick={() => handleBuy(pack)}
                            disabled={Boolean(processingPack)}
                        >
                            {processingPack === pack.id ? <><span className="payment-spinner" aria-hidden="true" />{stage || "Processing…"}</> : `Continue · ${pack.price}`}
                        </button>
                    </article>
                ))}
            </section>

            {processingPack && <p className="payment-processing" role="status" aria-live="polite" aria-busy="true"><span className="payment-spinner" aria-hidden="true" />{stage || "Processing payment…"} Complete checkout; credits appear after verification.</p>}
            {error && <div className="payment-feedback payment-error" role="alert"><strong>Payment not confirmed</strong><p>{error}</p><p>If your bank shows a charge, wait for verification or contact support before trying again.</p></div>}
            {message && <p className="payment-feedback payment-success" role="status"><span aria-hidden="true">✓</span>{message}</p>}
            <p className="buy-credits-security-note">Secure checkout powered by Razorpay. Credits are added only after payment verification.</p>
        </main>
    );
}

export default BuyCredits;
