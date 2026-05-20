import { Request, Response } from "express";
import {
  createShortUrl,
  getUrlStats,
  getUrlByCode,
  recordVisit,
  getTopUrls,
} from "../services/urlService";

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

export function statsHandler(req: Request, res: Response): void {
  const code = req.params.code;
  const stats = getUrlStats(code as string);
  res.json(stats);
}

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

export function topUrlsHandler(_req: Request, res: Response): void {
  const top = getTopUrls();
  res.json({ top_urls: top });
}
