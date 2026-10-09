import { app } from './app.js';
import { config } from './config.js';
import { loadAndValidateOrders } from './services/dataService.js';

function startServer() {
  console.log('='.repeat(70));
  console.log('           ORDERLY AI — Intelligent Order Assistant');
  console.log('='.repeat(70));
  console.log(`[Orderly AI] Initializing server in [${config.nodeEnv}] mode...`);
  console.log(`[Orderly AI] Target dataset: ${config.dataFilePath}`);

  // 1. CSV loading & validation with strict startup error
  try {
    const { orders, summary } = loadAndValidateOrders(config.dataFilePath);
    console.log(`[Orderly AI] [OK] Successfully validated and loaded ${orders.length} orders.`);
    console.log(`[Orderly AI] [OK] Date range: ${summary.dateRange.from} to ${summary.dateRange.to}`);
    console.log(`[Orderly AI] [OK] Total Revenue: INR ${summary.totalRevenueInr.toLocaleString('en-IN')}`);
  } catch (err) {
    console.error('\n' + '!'.repeat(70));
    console.error('[Orderly AI] FATAL STARTUP ERROR: Failed to load dataset!');
    console.error('-'.repeat(70));
    console.error(err.message);
    console.error('!'.repeat(70) + '\n');
    process.exit(1);
  }

  // 2. Start HTTP server
  const server = app.listen(config.port, () => {
    console.log(`[Orderly AI] [OK] Server running on http://localhost:${config.port}`);
    console.log(`[Orderly AI] [OK] Health check: http://localhost:${config.port}/api/health`);
    console.log('='.repeat(70));
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n[Orderly AI] Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      console.log('[Orderly AI] HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startServer();
