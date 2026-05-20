import { db } from "../database/db";
import { generateCode } from "../utils/generateCode";

interface UrlRow {
  id: number;
  short_code: string;
  original_url: string;
  created_at: string;
  visit_count: number;
  last_visited_at: string | null;
}

export function createShortUrl(url: string) {
  // const code = generateCode();
  const now = new Date().toISOString();
  let code!: string; //definite assignment for assertion

  //retry short code collision
  while (true) {
    code = generateCode();
    try {
      db.prepare("INSERT INTO urls (short_code, original_url, created_at) VALUES (?, ?, ?)")
        .run(code, url, now);
      break;
    } catch (error) {
      if ((error as any).code !== "SQLITE_CONSTRAINT_UNIQUE") {
        throw error;
      }
    }
  }

  return {
    short_code: code,
    short_url: `http://localhost:${process.env.PORT || 3000}/${code}`,
    original_url: url,
    created_at: now,
  };
}

export function getUrlStats(code: string) {
  if (!code || !/^[a-zA-Z0-9]+$/.test(code)) {
    return null;
  }

  const row = db
    .prepare("SELECT * FROM urls WHERE short_code = ?") //prepared statement for security
    .get(code) as UrlRow;

  if (!row) return null;

  return {
    short_code: row.short_code,
    original_url: row.original_url,
    created_at: row.created_at,
    visit_count: row.visit_count,
    last_visited_at: row.last_visited_at,
  };
}

export function getUrlByCode(code: string): UrlRow | undefined {
  return db
    .prepare("SELECT * FROM urls WHERE short_code = ?")
    .get(code) as UrlRow | undefined;
}

export function recordVisit(code: string): void {
  db.prepare(
    "UPDATE urls SET visit_count = visit_count + 1, last_visited_at = ? WHERE short_code = ?"
  ).run(new Date().toISOString(), code);
}

export function getTopUrls() {
  return db
    .prepare("SELECT * FROM urls ORDER BY visit_count DESC LIMIT 10")
    .all() as UrlRow[];
}
