import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { apiRouter } from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Request logger in non-test environments
  if (process.env.NODE_ENV !== 'test') {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[Orderly AI] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
      });
      next();
    });
  }

  // Mount API router
  app.use('/api', apiRouter);

  // Serve static frontend in production (or whenever dist exists)
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));

    // SPA fallback
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 404 for unmatched API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // Global error handler
  app.use((err, req, res, next) => {
    console.error('[Orderly AI Error]', err);
    res.status(err.status || 500).json({
      error: err.name || 'InternalServerError',
      message: err.message || 'An unexpected error occurred',
    });
  });

  return app;
}

export const app = createApp();
