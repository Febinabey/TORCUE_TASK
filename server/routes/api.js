import express from 'express';
import { dataService } from '../services/dataService.js';
import { config } from '../config.js';

export const apiRouter = express.Router();

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
