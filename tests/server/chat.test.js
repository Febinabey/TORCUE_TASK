import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../server/app.js';
import { dataService } from '../../server/services/dataService.js';
import { config } from '../../server/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const validCsvPath = path.resolve(__dirname, '../../data/orders.csv');

describe('POST /api/chat & Agent Interactions Suite', () => {
  let app;

  beforeAll(() => {
    dataService.loadAndValidateOrders(validCsvPath);
  });

  beforeEach(() => {
    app = createApp();
  });

  describe('Request Payload Validation', () => {
    it('should reject missing message field with HTTP 400', async () => {
      const res = await request(app).post('/api/chat').send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid Request');
      expect(res.body.message).toContain('required');
    });

    it('should reject empty / whitespace-only message with HTTP 400', async () => {
      const res = await request(app).post('/api/chat').send({ message: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid Request');
      expect(res.body.message).toContain('cannot be empty');
    });

    it('should reject non-string message with HTTP 400', async () => {
      const res = await request(app).post('/api/chat').send({ message: 12345 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid Request');
    });

    it('should reject message exceeding 2,000 characters with HTTP 400', async () => {
      const longMessage = 'A'.repeat(2001);
      const res = await request(app).post('/api/chat').send({ message: longMessage });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid Request');
      expect(res.body.message).toContain('cannot exceed 2000 characters');
    });
  });

  describe('Configuration & Upstream Error Handling', () => {
    it('should return HTTP 503 when API key is missing and no client is configured', async () => {
      const originalKey = config.gemini.apiKey;
      config.gemini.apiKey = null;

      const res = await request(app)
        .post('/api/chat')
        .send({ message: 'What is the status of ORD-1001?' });

      config.gemini.apiKey = originalKey;

      expect(res.status).toBe(503);
      expect(res.body.error).toBe('Service Unavailable');
      expect(res.body.message).toContain('Gemini API key is not configured');
    });

    it('should return sanitized HTTP 502 when upstream model fails', async () => {
      // Mock client that simulates an upstream network / rate-limit failure
      app.locals.mockAgentClient = {
        interactions: {
          create: async () => {
            throw new Error('RESOURCE_EXHAUSTED: Rate limit exceeded on quota group.');
          },
        },
      };

      const res = await request(app)
        .post('/api/chat')
        .send({ message: 'What is the status of order ORD-1025?' });

      expect(res.status).toBe(502);
      expect(res.body.error).toBe('Bad Gateway');
      expect(res.body.message).toContain('RESOURCE_EXHAUSTED');
      expect(res.body.stack).toBeUndefined(); // No leaked stack traces
    });
  });

  describe('Full Function Calling Cycle (Mocked Interactions API)', () => {
    it('should perform tool execution and return final assistant reply for lookup_order', async () => {
      let callCount = 0;
      let functionResultReceived = null;

      // Mock GoogleGenAI client implementing the Interactions API protocol
      app.locals.mockAgentClient = {
        interactions: {
          create: async (params) => {
            callCount++;
            if (callCount === 1) {
              // Turn 1: Model requests lookup_order tool call
              expect(params.input).toBe('What is the status of order ORD-1025?');
              expect(params.tools).toBeDefined();
              return {
                id: 'interaction_step_1',
                steps: [
                  {
                    type: 'function_call',
                    id: 'call_lookup_1025',
                    name: 'lookup_order',
                    arguments: { order_id: 'ORD-1025' },
                  },
                ],
              };
            }

            if (callCount === 2) {
              // Turn 2: Server sends back function results
              expect(params.previous_interaction_id).toBe('interaction_step_1');
              expect(params.input).toHaveLength(1);
              expect(params.input[0].type).toBe('function_result');
              expect(params.input[0].call_id).toBe('call_lookup_1025');
              expect(params.input[0].name).toBe('lookup_order');
              expect(params.input[0].result.success).toBe(true);
              expect(params.input[0].result.order.status).toBe('delivered');
              functionResultReceived = params.input[0].result;

              return {
                id: 'interaction_step_2',
                output_text:
                  'Order ORD-1025 (Wireless Mouse) for Karthik Rao in Kochi has been delivered.',
                steps: [
                  {
                    type: 'text',
                    text:
                      'Order ORD-1025 (Wireless Mouse) for Karthik Rao in Kochi has been delivered.',
                  },
                ],
              };
            }

            throw new Error('Unexpected extra call round');
          },
        },
      };

      const res = await request(app)
        .post('/api/chat')
        .send({ message: 'What is the status of order ORD-1025?' });

      expect(res.status).toBe(200);
      expect(res.body.reply).toBe(
        'Order ORD-1025 (Wireless Mouse) for Karthik Rao in Kochi has been delivered.'
      );
      expect(res.body.toolEvents).toEqual([
        {
          name: 'lookup_order',
          label: 'Looking up order ORD-1025',
          status: 'success',
        },
      ]);
      expect(functionResultReceived.order.product).toBe('Wireless Mouse');
    });

    it('should correctly handle multi-tool parallel calls in a single turn', async () => {
      let callCount = 0;

      app.locals.mockAgentClient = {
        interactions: {
          create: async (params) => {
            callCount++;
            if (callCount === 1) {
              // Model requests two tool calls simultaneously
              return {
                id: 'interaction_multi_1',
                steps: [
                  {
                    type: 'function_call',
                    id: 'call_1',
                    name: 'calculate_order_metrics',
                    arguments: { metric: 'count_orders', status: 'cancelled' },
                  },
                  {
                    type: 'function_call',
                    id: 'call_2',
                    name: 'calculate_order_metrics',
                    arguments: {
                      metric: 'sum_revenue',
                      category: 'Electronics',
                      month: 8,
                      year: 2026,
                    },
                  },
                ],
              };
            }

            if (callCount === 2) {
              expect(params.input).toHaveLength(2);
              expect(params.input[0].result.count).toBe(7);
              expect(params.input[1].result.total_revenue_inr).toBe(16692);

              return {
                id: 'interaction_multi_2',
                output_text:
                  'There are 7 cancelled orders, and revenue from Electronics in August 2026 was ₹16,692.',
                steps: [],
              };
            }

            throw new Error('Unexpected extra round');
          },
        },
      };

      const res = await request(app)
        .post('/api/chat')
        .send({ message: 'Compare cancelled orders and Electronics August revenue' });

      expect(res.status).toBe(200);
      expect(res.body.reply).toContain('7 cancelled orders');
      expect(res.body.reply).toContain('₹16,692');
      expect(res.body.toolEvents).toHaveLength(2);
      expect(res.body.toolEvents[0].status).toBe('success');
      expect(res.body.toolEvents[1].status).toBe('success');
    });
  });
});
