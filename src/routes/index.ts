import { Express } from "express";
import {
  shortenHandler,
  statsHandler,
  redirectHandler,
  topUrlsHandler,
} from "../handlers/urlHandlers";
import { rateLimitMiddleware } from "../middleware/rateLimiter";

/**
 * Registers all API routes on the Express application.
 *
 * Routes:
 * - `POST /shorten`     — create a shortened URL (rate limited)
 * - `GET  /stats/:code` — retrieve stats for a short code
 * - `GET  /admin/top`   — top 10 most-visited URLs
 * - `GET  /:code`       — redirect to the original URL
 */
export function registerRoutes(app: Express): void {
  app.post("/shorten", rateLimitMiddleware, shortenHandler);
  app.get("/stats/:code", statsHandler);
  app.get("/admin/top", topUrlsHandler);
  app.get("/:code", redirectHandler);
}
