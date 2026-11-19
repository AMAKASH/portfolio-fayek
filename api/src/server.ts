import type { Server } from 'node:http';
import { createApp } from './app.js';
import { connectDb, disconnectDb } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { bootstrapAdmin } from './modules/auth/auth.service.js';

async function main() {
  await connectDb();
  await bootstrapAdmin();

  const app = createApp();
  const server: Server = app.listen(env.PORT, () => logger.info(`API listening on :${env.PORT}`));
  // Keep-alive slightly above typical proxy idle timeouts to avoid 502s on reused sockets.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down gracefully');
    const force = setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 15_000);
    force.unref();
    server.close(async () => {
      await disconnectDb().catch(() => undefined);
      logger.info('Shutdown complete');
      process.exit(0);
    });
    server.closeIdleConnections();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'Unhandled rejection'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
