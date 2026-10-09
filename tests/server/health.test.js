import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/app.js';
import { dataService } from '../../server/services/dataService.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const validCsvPath = path.resolve(__dirname, '../../data/orders.csv');

describe('GET /api/health', () => {
  beforeAll(() => {
    // Ensure dataset is loaded for the test suite
    dataService.loadAndValidateOrders(validCsvPath);
  });

  it('should return 200 OK with service details and dataset status', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('service', 'orderly-ai');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptimeSeconds');
    expect(res.body.dataset).toEqual(
      expect.objectContaining({
        loaded: true,
        totalOrders: 60,
      })
    );
  });

  it('should return 404 for unknown API routes', async () => {
    const res = await request(app).get('/api/non-existent-endpoint');
    expect(res.status).toBe(404);
  });
});
