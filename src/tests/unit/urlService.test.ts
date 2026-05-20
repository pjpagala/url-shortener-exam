import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initDatabase, db } from '../../database/db';
import {
  createShortUrl,
  getUrlStats,
  getUrlByCode,
  recordVisit,
  getTopUrls,
  type TopUrlRow,
} from '../../services/urlService';

beforeAll(() => {
  initDatabase();
});

beforeEach(() => {
  db.exec('DELETE FROM urls');
});

// ─── createShortUrl ───────────────────────────────────────────────────

describe('createShortUrl', () => {
  it('returns the expected response shape', () => {
    const result = createShortUrl('https://example.com');
    expect(result).toMatchObject({
      short_code: expect.stringMatching(/^[a-zA-Z0-9]{6,8}$/),
      short_url: expect.stringContaining(result.short_code),
      original_url: 'https://example.com',
      created_at: expect.any(String),
    });
  });

  it('persists the URL in the database', () => {
    const result = createShortUrl('https://example.com');
    const row = db.prepare('SELECT * FROM urls WHERE short_code = ?').get(result.short_code);
    expect(row).toBeTruthy();
  });

  it('generates unique codes across multiple calls for the same URL', () => {
    const codes = Array.from({ length: 10 }, () =>
      createShortUrl('https://example.com').short_code
    );
    expect(new Set(codes).size).toBe(10);
  });

  it('created_at is a valid ISO 8601 date string', () => {
    const { created_at } = createShortUrl('https://example.com');
    expect(new Date(created_at).toISOString()).toBe(created_at);
  });
});

// ─── getUrlStats ──────────────────────────────────────────────────────

describe('getUrlStats', () => {
  it('returns null for an unknown code', () => {
    expect(getUrlStats('nonexistent')).toBeNull();
  });

  it('returns null for a code with invalid characters (SQL injection attempt)', () => {
    expect(getUrlStats("'; DROP TABLE urls; --")).toBeNull();
  });

  it('returns correct stats for an existing code', () => {
    const { short_code } = createShortUrl('https://example.com');
    const stats = getUrlStats(short_code);
    expect(stats).toMatchObject({
      short_code,
      original_url: 'https://example.com',
      visit_count: 0,
      last_visited_at: null,
    });
  });
});

// ─── getUrlByCode ─────────────────────────────────────────────────────

describe('getUrlByCode', () => {
  it('returns undefined for an unknown code', () => {
    expect(getUrlByCode('nonexistent')).toBeUndefined();
  });

  it('returns the row for an existing code', () => {
    const { short_code } = createShortUrl('https://example.com');
    const row = getUrlByCode(short_code);
    expect(row).toBeDefined();
    expect(row!.short_code).toBe(short_code);
    expect(row!.original_url).toBe('https://example.com');
  });
});

// ─── recordVisit ──────────────────────────────────────────────────────

describe('recordVisit', () => {
  it('increments visit_count by 1', () => {
    const { short_code } = createShortUrl('https://example.com');
    recordVisit(short_code);
    expect(getUrlByCode(short_code)!.visit_count).toBe(1);
  });

  it('sets last_visited_at to a non-null ISO string', () => {
    const { short_code } = createShortUrl('https://example.com');
    recordVisit(short_code);
    const row = getUrlByCode(short_code)!;
    expect(row.last_visited_at).not.toBeNull();
    expect(new Date(row.last_visited_at!).toISOString()).toBe(row.last_visited_at);
  });

  it('accumulates visit_count across multiple visits', () => {
    const { short_code } = createShortUrl('https://example.com');
    recordVisit(short_code);
    recordVisit(short_code);
    recordVisit(short_code);
    expect(getUrlByCode(short_code)!.visit_count).toBe(3);
  });
});

// ─── getTopUrls ───────────────────────────────────────────────────────

describe('getTopUrls', () => {
  it('returns an empty array when no URLs exist', () => {
    expect(getTopUrls()).toEqual([]);
  });

  it('returns URLs sorted by visit_count descending', () => {
    const b = createShortUrl('https://b.com');
    const c = createShortUrl('https://c.com');
    recordVisit(b.short_code);
    recordVisit(b.short_code);
    recordVisit(c.short_code);
    const top = getTopUrls();
    expect(top[0].short_code).toBe(b.short_code);
    expect(top[1].short_code).toBe(c.short_code);
  });

  it('excludes URLs with zero visits', () => {
    const a = createShortUrl('https://a.com');
    const b = createShortUrl('https://b.com');
    recordVisit(b.short_code);
    const top = getTopUrls();
    expect(top.some(r => r.short_code === a.short_code)).toBe(false);
    expect(top.some(r => r.short_code === b.short_code)).toBe(true);
  });

  it('returns at most 10 results even when more exist', () => {
    for (let i = 0; i < 15; i++) {
      createShortUrl(`https://example${i}.com`);
    }
    expect(getTopUrls().length).toBeLessThanOrEqual(10);
  });
});
