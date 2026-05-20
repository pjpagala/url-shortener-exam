import Database from "better-sqlite3";

const db = new Database("urls.db");

/**
 * Initialises the SQLite database schema.
 *
 * Creates the `urls` table if it does not already exist with:
 * - `short_code` — unique, non-null identifier for the shortened URL
 * - `original_url` — the full destination URL
 * - `created_at` — ISO 8601 creation timestamp
 * - `visit_count` — running total of redirects (defaults to 0)
 * - `last_visited_at` — ISO 8601 timestamp of the most recent visit
 */
export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS urls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      short_code TEXT UNIQUE NOT NULL,
      original_url TEXT NOT NULL,
      created_at TEXT NOT NULL,
      visit_count INTEGER DEFAULT 0,
      last_visited_at TEXT
    );
    -- Enhancement (C): index on visit_count speeds up ORDER BY visit_count DESC LIMIT 10
    CREATE INDEX IF NOT EXISTS idx_urls_visit_count ON urls (visit_count DESC);
  `);
}

export { db };
