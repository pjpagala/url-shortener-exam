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

/**
 * Creates a shortened URL entry in the database.
 *
 * Spec criteria:
 * - `short_code` must be unique (6–8 alphanumeric characters)
 * - Stores the mapping in the database
 * - Returns `short_code`, `short_url`, `original_url`, and `created_at`
 * - Retries on UNIQUE constraint collision until a free code is found
 *
 * @param url - A validated absolute URL string
 * @returns The created short URL record
 */
export function createShortUrl(url: string) {
  const now = new Date().toISOString();
  let code!: string; // definite assignment assertion

  // Retry on UNIQUE constraint collision until a free code is found
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

/**
 * Returns usage statistics for a given short code.
 *
 * Spec criteria:
 * - Returns `short_code`, `original_url`, `created_at`, `visit_count`, `last_visited_at`
 * - Returns `null` if the code does not exist (caller should respond 404)
 * - Input is validated against alphanumeric pattern to guard against SQL injection
 *
 * @param code - The short code to look up
 * @returns Stats object or `null` if not found / invalid
 */
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

/**
 * Looks up a URL row by its short code.
 *
 * Used by the redirect handler to resolve the original URL.
 *
 * @param code - The short code to look up
 * @returns The matching `UrlRow` or `undefined` if not found
 */
export function getUrlByCode(code: string): UrlRow | undefined {
  return db
    .prepare("SELECT * FROM urls WHERE short_code = ?")
    .get(code) as UrlRow | undefined;
}

/**
 * Records a visit for a short code.
 *
 * Spec criteria:
 * - Increments `visit_count` by 1
 * - Updates `last_visited_at` to the current UTC timestamp
 *
 * @param code - The short code that was visited
 */
export function recordVisit(code: string): void {
  db.prepare(
    "UPDATE urls SET visit_count = visit_count + 1, last_visited_at = ? WHERE short_code = ?"
  ).run(new Date().toISOString(), code);
}

/**
 * Returns the top 10 most-visited shortened URLs.
 *
 * Spec criteria:
 * - Sorted by `visit_count` descending
 * - Only includes URLs that have been visited at least once (`visit_count > 0`)
 * - Returns at most 10 results
 * - Sorting and limiting is done in SQL for efficiency
 *
 * @returns Array of up to 10 URL rows
 */
export function getTopUrls() {
  return db
    .prepare(
      "SELECT short_code, original_url, visit_count, last_visited_at FROM urls WHERE visit_count > 0 ORDER BY visit_count DESC LIMIT 10"
    )
    .all();
}
