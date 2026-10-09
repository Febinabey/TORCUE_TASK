import express from 'express';
import { z } from 'zod';
import { dataService } from '../services/dataService.js';
import { config } from '../config.js';
import {
  agentService,
  AiConfigurationMissingError,
  AgentExecutionError,
} from '../services/agentService.js';

export const apiRouter = express.Router();

const ChatRequestSchema = z.object({
  message: z
    .string({ required_error: 'Field "message" is required' })
    .trim()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message cannot exceed 2000 characters'),
});

/**
 * Health check endpoint
 * GET /api/health
 */
apiRouter.get('/health', (req, res) => {
  const isDatasetLoaded = dataService.isLoaded();
  const summary = dataService.getSummary();

  const healthData = {
    status: isDatasetLoaded ? 'ok' : 'degraded',
    service: 'orderly-ai',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: config.nodeEnv,
    dataset: {
      loaded: isDatasetLoaded,
      filePath: config.dataFilePath,
      totalOrders: summary?.totalOrders ?? 0,
      totalRevenueInr: summary?.totalRevenueInr ?? 0,
    },
    aiConfig: {
      provider: 'Gemini',
      model: config.gemini.model,
      keyConfigured: Boolean(config.gemini.apiKey),
    },
  };

  res.status(isDatasetLoaded ? 200 : 503).json(healthData);
});

/**
 * Dataset summary metrics
 * GET /api/orders/summary
 */
apiRouter.get('/orders/summary', (req, res) => {
  if (!dataService.isLoaded()) {
    return res.status(503).json({
      error: 'Dataset not loaded or server degraded',
    });
  }

  res.json(dataService.getSummary());
});

/**
 * List orders with optional filters
 * GET /api/orders?status=delivered&limit=20
 */
apiRouter.get('/orders', (req, res) => {
  if (!dataService.isLoaded()) {
    return res.status(503).json({
      error: 'Dataset not loaded or server degraded',
    });
  }

  let orders = dataService.getOrders();
  const { status, city, category, customer, limit } = req.query;

  if (status) {
    orders = orders.filter((o) => o.status.toLowerCase() === String(status).toLowerCase());
  }
  if (city) {
    orders = orders.filter((o) => o.city.toLowerCase() === String(city).toLowerCase());
  }
  if (category) {
    orders = orders.filter((o) => o.category.toLowerCase() === String(category).toLowerCase());
  }
  if (customer) {
    orders = orders.filter((o) =>
      o.customer_name.toLowerCase().includes(String(customer).toLowerCase())
    );
  }

  const parsedLimit = limit ? parseInt(String(limit), 10) : orders.length;
  const slicedOrders = orders.slice(0, Number.isNaN(parsedLimit) ? 50 : parsedLimit);

  res.json({
    total: orders.length,
    returned: slicedOrders.length,
    orders: slicedOrders,
  });
});

/**
 * AI Assistant Chat endpoint
 * POST /api/chat
 */
apiRouter.post('/chat', async (req, res) => {
  // 1. Validate request body
  const validation = ChatRequestSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Invalid Request',
      message: validation.error.issues[0]?.message || 'Invalid message payload',
    });
  }

  const { message } = validation.data;

  // 2. Ensure dataset is loaded
  if (!dataService.isLoaded()) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Orders dataset is not loaded. Please ensure dataset is available.',
    });
  }

  // 3. Ensure AI key is configured
  if (!config.gemini.apiKey && !req.app.locals.mockAgentClient) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message:
        'Gemini API key is not configured on the server. Please set GEMINI_API_KEY.',
    });
  }

  // 4. Execute conversational agent interaction
  try {
    const result = await agentService.chatWithAgent(message, {
      mockClient: req.app.locals.mockAgentClient,
    });

    res.json({
      reply: result.reply,
      toolEvents: result.toolEvents,
    });
  } catch (err) {
    if (err instanceof AiConfigurationMissingError) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: err.message,
      });
    }

    if (err instanceof AgentExecutionError) {
      return res.status(502).json({
        error: 'Bad Gateway',
        message: err.message,
      });
    }

    console.error('[Orderly AI Chat Route Error]', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while generating a response.',
    });
  }
});
