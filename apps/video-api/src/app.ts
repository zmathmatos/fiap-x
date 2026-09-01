import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { NotFoundError, type Logger } from '@fiapx/shared';
import { buildRoutes, type RouteDependencies } from './interface/http/routes';
import { requestContext } from './interface/http/middlewares/request-context';
import { createErrorHandler } from './interface/http/middlewares/error-handler';
import { metricsMiddleware } from './interface/http/middlewares/metrics';

export interface AppDependencies extends RouteDependencies {
  logger: Logger;
  corsOrigin: string;
}

export function buildApp(deps: AppDependencies): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: deps.corsOrigin === '*' ? true : deps.corsOrigin.split(',') }));
  app.use(requestContext());
  app.use(
    pinoHttp({
      logger: deps.logger,
      customProps: (req) => ({ correlationId: req.correlationId }),
      // Health and metrics are polled constantly; logging them buries real traffic.
      autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/metrics' },
    }),
  );
  app.use(metricsMiddleware());

  // JSON only for the auth routes — the upload route reads the raw multipart body.
  app.use(express.json({ limit: '64kb' }));

  app.use(buildRoutes(deps));

  app.use((req, _res, next) => next(new NotFoundError(`Rota ${req.method} ${req.path}`)));
  app.use(createErrorHandler(deps.logger));

  return app;
}
