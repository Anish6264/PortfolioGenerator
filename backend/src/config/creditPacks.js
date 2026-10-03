// Prices are expressed in paise, as required by Razorpay's Orders API.
const CREDIT_PACKS = Object.freeze({
    credits_10: Object.freeze({ credits: 10, amount: 4900, currency: "INR" }),
    credits_30: Object.freeze({ credits: 30, amount: 9900, currency: "INR" }),
    credits_75: Object.freeze({ credits: 75, amount: 19900, currency: "INR" })
});

module.exports = CREDIT_PACKS;
