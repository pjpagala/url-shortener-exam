import { Request, Response } from "express";
import {
  createShortUrl,
  getUrlStats,
  getUrlByCode,
  recordVisit,
  getTopUrls,
} from "../services/urlService";

/**
 * POST /shorten
 *
 * Spec criteria:
 * - Validates that `url` is present and a valid absolute URL
 * - Returns `400 Bad Request` for missing or malformed URLs
 * - Returns `201 Created` with `short_code`, `short_url`, `original_url`, `created_at`
 */
export function shortenHandler(req: Request, res: Response): void {
  const url = req.body.url;

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  try{
    new URL(url);
  } catch { 
    res.status(400).json({ error: "Invalid URL format" });
    return;
  }
  const result = createShortUrl(url);
  res.status(201).json(result);
}

/**
 * GET /stats/:code
 *
 * Spec criteria:
 * - Returns `200` with `short_code`, `original_url`, `created_at`, `visit_count`, `last_visited_at`
 * - Returns `404 Not Found` if the code does not exist
 */
export function statsHandler(req: Request, res: Response): void {
  const code = req.params.code;
  const stats = getUrlStats(code as string);
  if (!stats) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(stats);
}

/**
 * GET /:code
 *
 * Spec criteria:
 * - Returns `302 Found` redirecting to the original URL
 * - Returns `404 Not Found` if the code does not exist
 * - Tracks the visit: increments `visit_count` and records `last_visited_at`
 */
export function redirectHandler(req: Request, res: Response): void {
  const code = req.params.code;
  const row = getUrlByCode(code as string);

  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  recordVisit(code as string);
  res.redirect(row.original_url);
}

/**
 * GET /admin/top
 *
 * Spec criteria:
 * - Returns top 10 most-visited URLs sorted by `visit_count` descending
 * - Only includes URLs that have been visited at least once
 * - Response shape: `{ top_urls: [ { short_code, original_url, visit_count, last_visited_at } ] }`
 */
export function topUrlsHandler(_req: Request, res: Response): void {
  const top = getTopUrls();
  res.json({ top_urls: top });
}
