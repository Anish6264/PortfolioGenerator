const mongoose = require("mongoose");
const CreditReservation = require("../models/CreditReservation");
const Portfolio = require("../models/Portfolio");
const User = require("../models/User");

const CREDIT_RESERVATION_OPERATIONS = new Set([
    "github_project_import",
    "portfolio_generation"
]);
const GITHUB_RESERVATION_TTL_MS = 24 * 60 * 60 * 1000;
const PORTFOLIO_DOWNLOAD_RESERVATION_TTL_MS = 10 * 60 * 1000;

const reserveCredits = async ({ userId, credits, operation }) => {
    if (!Number.isInteger(credits) || credits < 1) {
        throw new TypeError("Credit reservation amount must be a positive integer");
    }
    if (!CREDIT_RESERVATION_OPERATIONS.has(operation)) {
        throw new TypeError("Invalid credit reservation operation");
    }

    const session = await mongoose.startSession();
    let reservation = null;
    let availableCredits = 0;
    try {
        await session.withTransaction(async () => {
            reservation = null;
            const user = await User.findOneAndUpdate(
                { _id: userId, credits: { $gte: credits, $mod: [1, 0] } },
                { $inc: { credits: -credits } },
                { returnDocument: "after", session }
            ).select("credits");

            if (!user) {
                const currentUser = await User.findById(userId).select("credits").session(session).lean();
                availableCredits = Number.isInteger(currentUser?.credits) ? currentUser.credits : 0;
                return;
            }

            availableCredits = user.credits;
            const [created] = await CreditReservation.create(
                [{ user: userId, operation, credits, status: "reserved" }],
                { session }
            );
            reservation = created;
        });
    } finally {
        await session.endSession();
    }

    return reservation
        ? { reservation, availableCredits }
        : { reservation: null, availableCredits };
};

const reservePortfolioDownload = async ({ userId, portfolioId, templateId, credits }) => {
    if (!Number.isInteger(credits) || credits < 1) {
        throw new TypeError("Credit reservation amount must be a positive integer");
    }

    const session = await mongoose.startSession();
    let result = { status: "not_found" };
    try {
        await session.withTransaction(async () => {
            result = { status: "not_found" };
            const portfolio = await Portfolio.findOne({ _id: portfolioId, user: userId })
                .select("+downloadReservation downloadPaid contentVersion paidDownloadVersion template")
                .session(session)
                .lean();

            if (!portfolio) return;
            const contentVersion = Number.isInteger(portfolio.contentVersion) && portfolio.contentVersion >= 1
                ? portfolio.contentVersion
                : 1;
            const paidDownloadVersion = Number.isInteger(portfolio.paidDownloadVersion)
                ? portfolio.paidDownloadVersion
                : 0;
            if (paidDownloadVersion === contentVersion) {
                result = { status: "already_paid" };
                return;
            }
            if (portfolio.downloadReservation) {
                result = { status: "in_progress" };
                return;
            }
            if (String(portfolio.template) !== String(templateId)) {
                result = { status: "template_changed" };
                return;
            }

            const user = await User.findOneAndUpdate(
                { _id: userId, credits: { $gte: credits, $mod: [1, 0] } },
                { $inc: { credits: -credits } },
                { returnDocument: "after", session }
            ).select("credits");

            if (!user) {
                const currentUser = await User.findById(userId).select("credits").session(session).lean();
                result = {
                    status: "insufficient_credits",
                    availableCredits: Number.isInteger(currentUser?.credits) ? currentUser.credits : 0
                };
                return;
            }

            const [reservation] = await CreditReservation.create(
                [{ user: userId, portfolio: portfolioId, contentVersion, operation: "portfolio_generation", credits, status: "reserved" }],
                { session }
            );
            const claim = await Portfolio.updateOne(
                {
                    _id: portfolioId,
                    user: userId,
                    template: templateId,
                    downloadReservation: null,
                    paidDownloadVersion: { $ne: contentVersion },
                    $or: [{ contentVersion }, { contentVersion: { $exists: false } }]
                },
                { $set: { downloadReservation: reservation._id } },
                { session }
            );

            if (claim.matchedCount !== 1) {
                const error = new Error("Portfolio download claim was lost");
                error.code = "PORTFOLIO_DOWNLOAD_CLAIM_LOST";
                throw error;
            }

            result = { status: "reserved", reservation, availableCredits: user.credits };
        });
    } catch (error) {
        if (error.code !== "PORTFOLIO_DOWNLOAD_CLAIM_LOST") throw error;
        const portfolio = await Portfolio.findOne({ _id: portfolioId, user: userId })
            .select("+downloadReservation downloadPaid contentVersion paidDownloadVersion template")
            .lean();
        if (!portfolio) result = { status: "not_found" };
        else if ((Number.isInteger(portfolio.paidDownloadVersion) ? portfolio.paidDownloadVersion : 0) === (Number.isInteger(portfolio.contentVersion) && portfolio.contentVersion >= 1 ? portfolio.contentVersion : 1)) result = { status: "already_paid" };
        else if (portfolio.downloadReservation) result = { status: "in_progress" };
        else result = { status: "template_changed" };
    } finally {
        await session.endSession();
    }

    return result;
};

const completeCreditReservation = async (reservationId, userId, status, expectedOperation) => {
    if (!["committed", "refunded"].includes(status)) {
        throw new TypeError("Invalid credit reservation completion status");
    }
    if (expectedOperation && !CREDIT_RESERVATION_OPERATIONS.has(expectedOperation)) {
        throw new TypeError("Invalid credit reservation operation");
    }

    const session = await mongoose.startSession();
    let completed = false;
    try {
        await session.withTransaction(async () => {
            completed = false;
            const reservation = await CreditReservation.findOneAndUpdate(
                {
                    _id: reservationId,
                    user: userId,
                    status: "reserved",
                    ...(expectedOperation ? { operation: expectedOperation } : {})
                },
                { $set: { status, completedAt: new Date() } },
                { returnDocument: "after", session }
            );

            if (!reservation) {
                const current = await CreditReservation.findOne({
                    _id: reservationId,
                    user: userId,
                    ...(expectedOperation ? { operation: expectedOperation } : {})
                })
                    .session(session)
                    .lean();
                if (current?.status === status) return;
                throw new Error("Credit reservation is no longer active");
            }

            if (status === "refunded") {
                const result = await User.updateOne(
                    { _id: userId },
                    { $inc: { credits: reservation.credits } },
                    { session }
                );
                if (result.matchedCount !== 1) throw new Error("Credit reservation user was not found");
            }

            if (reservation.operation === "portfolio_generation" && reservation.portfolio) {
                const portfolioResult = await Portfolio.updateOne(
                    {
                        _id: reservation.portfolio,
                        user: userId,
                        downloadReservation: reservation._id,
                        $or: [
                            { contentVersion: reservation.contentVersion },
                            { contentVersion: { $exists: false } }
                        ]
                    },
                    status === "committed"
                        ? { $set: { downloadPaid: true, contentVersion: reservation.contentVersion || 1, paidDownloadVersion: reservation.contentVersion || 1, downloadReservation: null } }
                        : { $set: { downloadReservation: null } },
                    { session }
                );
                if (portfolioResult.matchedCount !== 1) {
                    const currentPortfolio = await Portfolio.findOne({
                        _id: reservation.portfolio,
                        user: userId,
                        paidDownloadVersion: reservation.contentVersion || 1,
                        contentVersion: reservation.contentVersion || 1
                    }).session(session).lean();
                    const portfolioExists = currentPortfolio || await Portfolio.exists({
                        _id: reservation.portfolio,
                        user: userId
                    }).session(session);
                    if (portfolioExists && !(status === "committed" && currentPortfolio)) {
                        throw new Error("Portfolio download reservation is no longer active");
                    }
                }
            }

            completed = true;
        });
    } finally {
        await session.endSession();
    }
    return completed;
};

const commitCreditReservation = (reservationId, userId, expectedOperation) =>
    completeCreditReservation(reservationId, userId, "committed", expectedOperation);

const refundCreditReservation = (reservationId, userId, expectedOperation) =>
    completeCreditReservation(reservationId, userId, "refunded", expectedOperation);

const refreshPortfolioDownloadReservation = async (reservationId, userId) => {
    const result = await CreditReservation.updateOne(
        {
            _id: reservationId,
            user: userId,
            operation: "portfolio_generation",
            status: "reserved"
        },
        { $set: { updatedAt: new Date() } }
    );
    return result.matchedCount === 1;
};

const refundExpiredGitHubReservations = async (now = new Date()) => {
    const cutoff = new Date(now.getTime() - GITHUB_RESERVATION_TTL_MS);
    const staleReservations = await CreditReservation.find({
        operation: "github_project_import",
        status: "reserved",
        createdAt: { $lte: cutoff }
    }).select("_id user").limit(100).lean();

    let refunded = 0;
    for (const reservation of staleReservations) {
        try {
            await refundCreditReservation(reservation._id, reservation.user, "github_project_import");
            refunded += 1;
        } catch (error) {
            if (error.message !== "Credit reservation is no longer active") throw error;
        }
    }
    return refunded;
};

const refundExpiredPortfolioDownloadReservations = async (now = new Date()) => {
    const cutoff = new Date(now.getTime() - PORTFOLIO_DOWNLOAD_RESERVATION_TTL_MS);
    const staleReservations = await CreditReservation.find({
        operation: "portfolio_generation",
        status: "reserved",
        updatedAt: { $lte: cutoff }
    }).select("_id user").limit(100).lean();

    let refunded = 0;
    for (const reservation of staleReservations) {
        try {
            const completed = await refundCreditReservation(reservation._id, reservation.user, "portfolio_generation");
            if (completed) refunded += 1;
        } catch (error) {
            if (error.message !== "Credit reservation is no longer active") throw error;
        }
    }
    return refunded;
};

module.exports = {
    reserveCredits,
    reservePortfolioDownload,
    commitCreditReservation,
    refundCreditReservation,
    refreshPortfolioDownloadReservation,
    refundExpiredGitHubReservations,
    refundExpiredPortfolioDownloadReservations
};
