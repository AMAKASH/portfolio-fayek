import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { apiLimiter } from './middleware/rate-limit.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { v1 } from './routes.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY); // behind Dokploy/Traefik
  app.set('etag', 'weak'); // cheap 304s on cacheable GETs

  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/health' },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    }),
  );
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.CORS_ORIGINS.includes(origin)),
      credentials: true, // refresh-token cookie
      maxAge: 86_400, // cache preflights for a day
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' })); // media never passes through the API
  app.use(cookieParser());

  app.use('/health', healthRoutes);
  app.use('/api/v1', apiLimiter, v1);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
