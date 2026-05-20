import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { db } from '../database/db';

beforeEach(() => {
  db.exec('DELETE FROM urls');
});

// ─── Health Check ────────────────────────────────────────────────────

describe('Health Check', () => {
  it('GET /health should return 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
