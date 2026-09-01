import request from 'supertest';
import express, { type Express } from 'express';
import { createLogger, NotFoundError, ValidationError } from '@fiapx/shared';
import { createErrorHandler } from '../../src/interface/http/middlewares/error-handler';

function appThatThrows(error: unknown): Express {
  const app = express();
  app.use(express.json());
  app.post('/boom', (_req, _res, next) => next(error));
  app.use(createErrorHandler(createLogger('test')));
  return app;
}

describe('error handler', () => {
  it('maps a domain error to its status and code', async () => {
    const res = await request(appThatThrows(new ValidationError('Campo obrigatório.'))).post(
      '/boom',
    );

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'Campo obrigatório.' },
    });
  });

  it('maps a not found error to 404', async () => {
    const res = await request(appThatThrows(new NotFoundError('Vídeo'))).post('/boom');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('hides the details of an unexpected error behind a 500', async () => {
    const res = await request(appThatThrows(new Error('connection string leaked'))).post('/boom');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('connection string leaked');
  });

  it('answers 400 for malformed JSON instead of treating it as a server fault', async () => {
    const app = express();
    app.use(express.json());
    app.post('/echo', (_req, res) => {
      res.status(200).json({ ok: true });
    });
    app.use(createErrorHandler(createLogger('test')));

    const res = await request(app)
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{not-json}');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('does not expose an http-error that was not marked as safe to show', async () => {
    const hidden = Object.assign(new Error('internal detail'), {
      statusCode: 400,
      expose: false,
    });

    const res = await request(appThatThrows(hidden)).post('/boom');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
