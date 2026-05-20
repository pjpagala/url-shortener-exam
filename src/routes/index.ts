import { Express } from "express";
import {
  shortenHandler,
  statsHandler,
  redirectHandler,
  topUrlsHandler,
} from "../handlers/urlHandlers";
import { rateLimitMiddleware } from "../middleware/rateLimiter";

export function registerRoutes(app: Express): void {
  app.post("/shorten", rateLimitMiddleware, shortenHandler);
  app.get("/stats/:code", statsHandler);
  app.get("/admin/top", topUrlsHandler);
  app.get("/:code", rateLimitMiddleware, redirectHandler);
}
