import { Router } from 'express';
import type { AuthController } from './controllers/auth-controller';
import type { VideoController } from './controllers/video-controller';
import type { HealthController } from './controllers/health-controller';
import { authenticate } from './middlewares/authenticate';
import type { TokenService } from '../../domain/ports/token-service';

export interface RouteDependencies {
  authController: AuthController;
  videoController: VideoController;
  healthController: HealthController;
  tokenService: TokenService;
}

export function buildRoutes(deps: RouteDependencies): Router {
  const router = Router();
  const protect = authenticate(deps.tokenService);

  router.get('/health', deps.healthController.live);
  router.get('/health/ready', deps.healthController.ready);
  router.get('/metrics', deps.healthController.metrics);

  router.post('/auth/register', deps.authController.register);
  router.post('/auth/login', deps.authController.login);
  router.get('/me', protect, deps.authController.me);

  router.post('/videos', protect, deps.videoController.upload);
  router.get('/videos', protect, deps.videoController.list);
  router.get('/videos/:id', protect, deps.videoController.detail);
  router.get('/videos/:id/download', protect, deps.videoController.download);

  return router;
}
