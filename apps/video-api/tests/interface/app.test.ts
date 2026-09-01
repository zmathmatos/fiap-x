import request from 'supertest';
import type { Express } from 'express';
import { createLogger, UnauthorizedError } from '@fiapx/shared';
import { buildApp } from '../../src/app';
import { HealthController, type HealthChecks } from '../../src/interface/http/controllers/health-controller';
import type { AuthController } from '../../src/interface/http/controllers/auth-controller';
import type { VideoController } from '../../src/interface/http/controllers/video-controller';
import type { TokenService } from '../../src/domain/ports/token-service';

const tokenService: TokenService = {
  sign: () => 'signed',
  verify: (token) => {
    if (token !== 'good-token') throw new UnauthorizedError('Sessão expirada ou inválida.');
    return { sub: 'u1', email: 'a@b.c' };
  },
};

function makeApp(checkOverrides: Partial<HealthChecks> = {}): {
  app: Express;
  checks: jest.Mocked<HealthChecks>;
} {
  const checks = {
    postgres: jest.fn().mockResolvedValue(true),
    rabbitmq: jest.fn().mockResolvedValue(true),
    storage: jest.fn().mockResolvedValue(true),
    redis: jest.fn().mockResolvedValue(true),
    ...checkOverrides,
  } as jest.Mocked<HealthChecks>;

  const noop = jest.fn(async (_req, res) => {
    res.status(200).json({ ok: true });
  });

  const app = buildApp({
    logger: createLogger('test'),
    corsOrigin: '*',
    tokenService,
    healthController: new HealthController(checks),
    authController: { register: noop, login: noop, me: noop } as unknown as AuthController,
    videoController: {
      upload: noop,
      list: noop,
      detail: noop,
      download: noop,
    } as unknown as VideoController,
  });

  return { app, checks };
}

describe('app', () => {
  it('reports liveness without touching dependencies', async () => {
    const { app, checks } = makeApp();

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(checks.postgres).not.toHaveBeenCalled();
  });

  it('reports ready when every dependency answers', async () => {
    const { app } = makeApp();

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  it('reports 503 when a dependency is down', async () => {
    const { app } = makeApp({ postgres: jest.fn().mockResolvedValue(false) });

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body.checks.postgres).toBe(false);
    expect(res.body.checks.redis).toBe(true);
  });

  it('exposes prometheus metrics', async () => {
    const { app } = makeApp();

    const res = await request(app).get('/metrics');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('videos_uploaded_total');
  });

  it('rejects an unauthenticated request to /videos', async () => {
    const { app } = makeApp();

    const res = await request(app).get('/videos');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('lets an authenticated request through', async () => {
    const { app } = makeApp();

    const res = await request(app).get('/videos').set('Authorization', 'Bearer good-token');

    expect(res.status).toBe(200);
  });

  it('answers 404 with a structured error for an unknown route', async () => {
    const { app } = makeApp();

    const res = await request(app).get('/nope');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('echoes the correlation id back', async () => {
    const { app } = makeApp();

    const res = await request(app).get('/health').set('x-correlation-id', 'corr-123');

    expect(res.headers['x-correlation-id']).toBe('corr-123');
  });

  it('generates a correlation id when the client does not send one', async () => {
    const { app } = makeApp();

    const res = await request(app).get('/health');

    expect(res.headers['x-correlation-id']).toHaveLength(36);
  });
});
