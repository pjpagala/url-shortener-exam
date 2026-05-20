import { Request, Response, NextFunction } from "express";

const rateLimits: Record<string, number[]> = {};

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
