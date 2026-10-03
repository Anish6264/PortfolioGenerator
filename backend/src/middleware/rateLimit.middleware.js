const buckets = new Map();
const MAX_BUCKETS = 50_000;

const createRateLimiter = ({ name, windowMs, max, byUser = false }) => (req, res, next) => {
    const identity = byUser && req.user?.id
        ? `user:${req.user.id}`
        : `ip:${req.ip || req.socket?.remoteAddress || "unknown"}`;
    const key = `${name}:${identity}`;
    const now = Date.now();
    let entry = buckets.get(key);

    if (!entry || entry.resetAt <= now) {
        if (buckets.size >= MAX_BUCKETS) {
            for (const [existingKey, existing] of buckets) {
                if (existing.resetAt <= now) buckets.delete(existingKey);
                if (buckets.size < MAX_BUCKETS) break;
            }
            if (buckets.size >= MAX_BUCKETS) buckets.delete(buckets.keys().next().value);
        }
        entry = { count: 0, resetAt: now + windowMs };
        buckets.set(key, entry);
    }

    entry.count += 1;
    if (entry.count > max) {
        const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
        res.set("Retry-After", String(retryAfter));
        return res.status(429).json({ code: "RATE_LIMITED", message: "Too many requests. Please try again later." });
    }
    return next();
};

module.exports = createRateLimiter;
