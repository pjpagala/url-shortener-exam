import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { db } from '../database/db';
import { clearRateLimits } from '../middleware/rateLimiter';

beforeEach(() => {
  db.exec('DELETE FROM urls');
  clearRateLimits();
});

// ─── Health Check ────────────────────────────────────────────────────

describe('Health Check', () => {
  it('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

// ─── POST /shorten ────────────────────────────────────────────────────

describe('POST /shorten', () => {
  it('returns 201 with expected shape for a valid URL', async () => {
    const res = await request(app)
      .post('/shorten')
      .send({ url: 'https://example.com/some/long/path' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      short_code: expect.stringMatching(/^[a-zA-Z0-9]{6,8}$/),
      short_url: expect.stringContaining(res.body.short_code),
      original_url: 'https://example.com/some/long/path',
      created_at: expect.any(String),
    });
  });

  it('returns 400 when url field is missing', async () => {
    const res = await request(app).post('/shorten').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when url is not a string', async () => {
    const res = await request(app).post('/shorten').send({ url: 12345 });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed URL', async () => {
    const res = await request(app).post('/shorten').send({ url: 'not-a-url' });
    expect(res.status).toBe(400);
  });

  it('generates a unique short_code on each call', async () => {
    const a = await request(app).post('/shorten').send({ url: 'https://example.com' });
    const b = await request(app).post('/shorten').send({ url: 'https://example.com' });
    expect(a.body.short_code).not.toBe(b.body.short_code);
  });

  it('returns 429 after 10 requests from the same IP', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app).post('/shorten').send({ url: 'https://example.com' });
    }
    const res = await request(app).post('/shorten').send({ url: 'https://example.com' });
    expect(res.status).toBe(429);
    expect(res.body).toHaveProperty('retry_after_seconds');
    expect(res.body.error).toBe('Rate limit exceeded. Try again later.');
  });
});

// ─── GET /:code ───────────────────────────────────────────────────────

describe('GET /:code', () => {
  it('redirects (302) to the original URL for a valid code', async () => {
    const create = await request(app)
      .post('/shorten')
      .send({ url: 'https://example.com' });
    const code = create.body.short_code;

    const res = await request(app).get(`/${code}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://example.com');
  });

  it('returns 404 for an unknown code', async () => {
    const res = await request(app).get('/doesnotexist');
    expect(res.status).toBe(404);
  });

  it('increments visit_count on redirect', async () => {
    const create = await request(app)
      .post('/shorten')
      .send({ url: 'https://example.com' });
    const code = create.body.short_code;

    await request(app).get(`/${code}`);
    await request(app).get(`/${code}`);

    const stats = await request(app).get(`/stats/${code}`);
    expect(stats.body.visit_count).toBe(2);
  });

  it('sets last_visited_at after redirect', async () => {
    const create = await request(app)
      .post('/shorten')
      .send({ url: 'https://example.com' });
    const code = create.body.short_code;

    await request(app).get(`/${code}`);

    const stats = await request(app).get(`/stats/${code}`);
    expect(stats.body.last_visited_at).not.toBeNull();
  });
});

// ─── GET /stats/:code ─────────────────────────────────────────────────

describe('GET /stats/:code', () => {
  it('returns 200 with full stats for a valid code', async () => {
    const create = await request(app)
      .post('/shorten')
      .send({ url: 'https://example.com' });
    const code = create.body.short_code;

    const res = await request(app).get(`/stats/${code}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      short_code: code,
      original_url: 'https://example.com',
      visit_count: 0,
      created_at: expect.any(String),
    });
  });

  it('returns 404 for an unknown code', async () => {
    const res = await request(app).get('/stats/doesnotexist');
    expect(res.status).toBe(404);
  });
});

// ─── GET /admin/top ───────────────────────────────────────────────────

describe('GET /admin/top', () => {
  it('returns top_urls array', async () => {
    const res = await request(app).get('/admin/top');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('top_urls');
    expect(Array.isArray(res.body.top_urls)).toBe(true);
  });

  it('returns at most 10 results', async () => {
    for (let i = 0; i < 12; i++) {
      await request(app).post('/shorten').send({ url: `https://example${i}.com` });
    }
    const res = await request(app).get('/admin/top');
    expect(res.body.top_urls.length).toBeLessThanOrEqual(10);
  });

  it('returns results sorted by visit_count descending', async () => {
    const a = await request(app).post('/shorten').send({ url: 'https://a.com' });
    const b = await request(app).post('/shorten').send({ url: 'https://b.com' });

    // visit b twice, a once
    await request(app).get(`/${b.body.short_code}`);
    await request(app).get(`/${b.body.short_code}`);
    await request(app).get(`/${a.body.short_code}`);

    const res = await request(app).get('/admin/top');
    const top = res.body.top_urls;
    expect(top[0].short_code).toBe(b.body.short_code);
    expect(top[1].short_code).toBe(a.body.short_code);
  });
});
