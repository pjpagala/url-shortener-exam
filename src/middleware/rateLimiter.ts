import { Request, Response, NextFunction } from "express";

const rateLimits: Record<string, number[]> = {};

/** Clear all rate limit state — for use in tests only */
export function clearRateLimits(): void {
  for (const key of Object.keys(rateLimits)) {
    delete rateLimits[key];
  }
}

/**
 * Rate limiting middleware for `POST /shorten`.
 *
 * Spec criteria:
 * - Maximum 10 requests per IP address per 60-second sliding window
 * - Returns `429 Too Many Requests` when the limit is exceeded
 * - `429` response body: `{ error: "Rate limit exceeded. Try again later.", retry_after_seconds: <n> }`
 * - `retry_after_seconds` is calculated from the oldest request timestamp in the current window
 */
export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const ip = req.ip || "unknown";
  const now = Date.now();

  if (!rateLimits[ip]) {
    rateLimits[ip] = [];
  }

  rateLimits[ip] = rateLimits[ip].filter((t) => now - t < 60000);

  if (rateLimits[ip].length >= 10) {
    const oldest = rateLimits[ip][0];
    const retryAfter = Math.ceil((60000 - (now - oldest)) / 1000);
    res.status(429).json({ error: "Rate limit exceeded. Try again later.","retry_after_seconds": retryAfter });
    return;
  }

  rateLimits[ip].push(now);
  next();
}
