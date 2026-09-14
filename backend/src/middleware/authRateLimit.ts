import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";

function rateLimitHandler(_req: Request, res: Response): void {
  res.status(429).json({ error: "Слишком много попыток, попробуйте позже" });
}

// Single-process, single-container deployment (no horizontal scaling, see
// docker-compose.yml) — an in-memory store is the right fit, no Redis needed.
// Requires app.set("trust proxy", 1) in app.ts: both nginx (prod) and Vite's
// dev proxy sit in front of this process, so without that Express would see
// every request as coming from the proxy's own address and an IP-keyed
// limiter would bucket every user together.

/** Catches one IP spraying many usernames. */
export const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * Catches distributed brute-forcing of one account across many IPs.
 * `skipSuccessfulRequests` stops counting once someone gets it right, and
 * `/login` also explicitly calls `.resetKey(...)` on success (see auth.ts)
 * so a real user who fumbled their password a couple of times isn't left
 * sitting close to the limit.
 */
export const loginUsernameLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request): string => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim().toLowerCase() : null;
    return name || req.ip || "unknown";
  },
  handler: rateLimitHandler,
});

/** Registration has no "target account" the way login does — each attempt is a fresh name — so IP-only is proportionate. */
export const registerIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
});
