import Database from "better-sqlite3";

const db = new Database("urls.db");

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS urls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      short_code TEXT UNIQUE NOT NULL,
      original_url TEXT NOT NULL,
      created_at TEXT NOT NULL,
      visit_count INTEGER DEFAULT 0,
      last_visited_at TEXT
    )
  `);
}

export { db };
