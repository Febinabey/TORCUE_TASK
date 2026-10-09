import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../server/app.js';
import { dataService } from '../../server/services/dataService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../../dist');
const validCsvPath = path.resolve(__dirname, '../../data/orders.csv');

describe('Production Static Serving', () => {
  beforeAll(() => {
    dataService.loadAndValidateOrders(validCsvPath);
  });

  it('dist/index.html should exist after build', () => {
    expect(fs.existsSync(path.join(distPath, 'index.html'))).toBe(true);
  });

  it('GET / should serve the built React application (HTML)', async () => {
    const app = createApp();
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('Orderly AI');
    expect(res.text).toContain('/assets/index-');
  });

  it('GET /api/health should still function alongside static serving', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
