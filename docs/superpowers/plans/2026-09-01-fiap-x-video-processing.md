# FIAP X — Sistema de Processamento de Vídeos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um monorepo com três microsserviços event-driven e um frontend React que recebe vídeos, extrai frames com ffmpeg de forma assíncrona e entrega um `.zip`, com autenticação, persistência, resiliência a picos e CI/CD.

**Architecture:** `video-api` (Express, dona do Postgres) recebe o upload em stream para o MinIO e publica `video.uploaded` no RabbitMQ. `video-processor` (worker stateless, N réplicas) consome, roda ffmpeg, compacta e publica o resultado. `video-api` consome os eventos de resultado e atualiza o status; `notification-service` consome os mesmos eventos e envia e-mail. Cada serviço segue Clean Architecture (`domain / application / infrastructure / interface`).

**Tech Stack:** Node.js 22+ · TypeScript 5 · Express 5 · TypeORM + PostgreSQL 17 · RabbitMQ (amqplib) · Redis 7 (ioredis) · MinIO via AWS SDK v3 · Pino · prom-client · Jest · Cucumber · Vitest · React 18 + Vite · Docker Compose · Kubernetes · GitHub Actions

**Spec:** `docs/superpowers/specs/2026-09-01-fiap-x-video-processing-design.md`

## Global Constraints

- Node.js **22 ou superior** (a máquina usa 24.19.0 via nvm). `npm` 11+.
- Monorepo com **npm workspaces**: `apps/*` e `packages/*`. Nenhuma dependência entre `apps/*`; tudo compartilhado vive em `packages/shared`.
- TypeScript `strict: true` em todos os pacotes. Sem `any` implícito. Sem `// @ts-ignore`.
- Clean Architecture obrigatória nos serviços: `domain` não importa nada de `infrastructure` nem de `interface`. `application` só depende de `domain` e de portas (interfaces).
- Toda mensagem publicada usa o envelope `EventEnvelope<T>` de `@fiapx/shared`.
- Cobertura mínima **80%** por serviço (`branches`, `functions`, `lines`, `statements`).
- Logs sempre JSON via Pino, com `correlationId`. Proibido `console.log` fora de scripts.
- Segredos apenas por variável de ambiente. Nenhum segredo commitado. `.env.example` documenta todas as variáveis.
- Idioma: código, identificadores e mensagens de commit em **inglês**; documentação de entrega (`README.md`, `docs/`) em **português**.
- Commits no formato Conventional Commits. **Nunca** adicionar trailers de coautoria.
- Frontend: sem biblioteca de componentes. Proibidos gradiente roxo-azul, emoji decorativo, card único centralizado com ícone grande e texto de marketing.

---

## File Structure

```
fiap-x/
├── package.json                      workspaces, scripts agregados
├── tsconfig.base.json                compilerOptions compartilhadas
├── .eslintrc.json .prettierrc .gitignore .env.example
├── packages/shared/
│   └── src/
│       ├── events/                   envelope, tipos e routing keys
│       ├── logger/                   Pino + correlationId
│       ├── messaging/                RabbitMQ client, topology, consumer runner
│       ├── storage/                  ObjectStorage (S3/MinIO)
│       ├── idempotency/              Redis SET NX
│       └── errors/                   erros de domínio
├── apps/video-api/
│   └── src/
│       ├── domain/                   User, Video, VideoStatus, ports
│       ├── application/              use cases
│       ├── infrastructure/           TypeORM, repositórios, publisher, consumers
│       └── interface/                Express controllers, rotas, middlewares
├── apps/video-processor/
│   └── src/
│       ├── domain/                   FrameExtraction, ports
│       ├── application/              ProcessVideoUseCase
│       ├── infrastructure/           ffmpeg, archiver, storage, consumer
│       └── interface/                healthcheck HTTP mínimo
├── apps/notification-service/
│   └── src/{domain,application,infrastructure,interface}
├── apps/web/
│   └── src/{styles,lib,components,features,pages}
├── infra/
│   ├── docker-compose.yml  docker-compose.override.yml
│   ├── db/init.sql
│   ├── prometheus/prometheus.yml
│   ├── grafana/provisioning/…
│   └── k8s/*.yaml
├── docs/
│   ├── architecture.md  demo-script.md  adr/
└── .github/workflows/{ci.yml,cd.yml}
```

---

### Task 1: Fundação do monorepo

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.eslintrc.json`, `.prettierrc`, `.editorconfig`, `.nvmrc`, `.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nada
- Produces: workspaces `@fiapx/shared`, `@fiapx/video-api`, `@fiapx/video-processor`, `@fiapx/notification-service`, `@fiapx/web`; scripts raiz `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`

- [ ] **Step 1: Criar `package.json` raiz**

```json
{
  "name": "fiap-x",
  "private": true,
  "engines": { "node": ">=22" },
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "test:unit": "npm run test:unit --workspaces --if-present",
    "build": "npm run build --workspaces --if-present"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "@typescript-eslint/eslint-plugin": "^8.18.0",
    "@typescript-eslint/parser": "^8.18.0",
    "eslint": "^8.57.1",
    "prettier": "^3.4.2",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Criar `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

- [ ] **Step 3: Criar `.eslintrc.json`, `.prettierrc`, `.nvmrc`**

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  "env": { "node": true, "es2023": true },
  "ignorePatterns": ["dist", "node_modules", "coverage", "*.config.js"],
  "rules": {
    "no-console": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": ["warn", { "allowExpressions": true }]
  }
}
```

`.prettierrc`: `{ "singleQuote": true, "printWidth": 100, "trailingComma": "all" }`
`.nvmrc`: `24.19.0`

- [ ] **Step 4: Criar `.env.example` com todas as variáveis**

```bash
NODE_ENV=development
LOG_LEVEL=info

# video-api
API_PORT=3000
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=8h
MAX_UPLOAD_BYTES=524288000

# postgres
DB_HOST=postgres
DB_PORT=5432
DB_NAME=fiapx
DB_USER=fiapx_video
DB_PASSWORD=fiapx_video_pwd
DB_SCHEMA=video

# redis
REDIS_URL=redis://redis:6379

# rabbitmq
RABBITMQ_URL=amqp://fiapx:fiapx@rabbitmq:5672
RABBITMQ_EXCHANGE=video-events

# object storage (MinIO / S3)
STORAGE_ENDPOINT=http://minio:9000
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY=fiapx
STORAGE_SECRET_KEY=fiapx-secret
STORAGE_BUCKET_RAW=fiapx-raw
STORAGE_BUCKET_ZIPS=fiapx-zips
STORAGE_FORCE_PATH_STYLE=true

# processor
FRAME_INTERVAL_SECONDS=20
PROCESSOR_CONCURRENCY=1

# notification
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_FROM="FIAP X <no-reply@fiapx.local>"
APP_PUBLIC_URL=http://localhost:8080
```

- [ ] **Step 5: Instalar e validar**

Run: `npm install && npx tsc --noEmit -p tsconfig.base.json --composite false || true && npx eslint --version`
Expected: instalação conclui sem erro; eslint imprime versão.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: bootstrap monorepo with npm workspaces and shared toolchain"
```

---

### Task 2: `packages/shared` — contratos de evento, erros e logger

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/jest.config.js`
- Create: `packages/shared/src/events/envelope.ts`, `events/routing-keys.ts`, `events/payloads.ts`, `events/index.ts`
- Create: `packages/shared/src/errors/index.ts`
- Create: `packages/shared/src/logger/index.ts`
- Create: `packages/shared/src/index.ts`
- Test: `packages/shared/tests/events/envelope.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `interface EventEnvelope<T> { eventId: string; eventType: string; occurredAt: string; correlationId: string; payload: T }`
  - `createEnvelope<T>(eventType: string, payload: T, correlationId?: string): EventEnvelope<T>`
  - `parseEnvelope<T>(raw: Buffer | string): EventEnvelope<T>` (lança `InvalidEventError`)
  - `ROUTING_KEYS = { VIDEO_UPLOADED: 'video.uploaded', VIDEO_PROCESSING_STARTED: 'video.processing.started', VIDEO_PROCESSED: 'video.processed', VIDEO_FAILED: 'video.failed' } as const`
  - `VideoUploadedPayload { videoId, userId, userEmail, storageKey, originalName, frameIntervalSeconds }`
  - `VideoProcessingStartedPayload { videoId }`
  - `VideoProcessedPayload { videoId, userEmail, originalName, zipKey, frameCount, durationMs, sizeBytes }`
  - `VideoFailedPayload { videoId, userEmail, originalName, reason, attempt }`

  `userEmail` e `originalName` viajam em todos os payloads de resultado porque o
  `notification-service` não acessa o banco — ele precisa montar o e-mail apenas com o evento.
  - `AppError`, `NotFoundError`, `UnauthorizedError`, `ValidationError`, `InvalidEventError`
  - `createLogger(name: string): Logger` (Pino)

- [ ] **Step 1: Escrever o teste que falha**

`packages/shared/tests/events/envelope.test.ts`:

```ts
import { createEnvelope, parseEnvelope, ROUTING_KEYS } from '../../src/events';
import { InvalidEventError } from '../../src/errors';

describe('event envelope', () => {
  it('creates an envelope with a uuid, iso date and the given payload', () => {
    const env = createEnvelope(ROUTING_KEYS.VIDEO_UPLOADED, { videoId: 'v1' });

    expect(env.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(env.eventType).toBe('video.uploaded');
    expect(new Date(env.occurredAt).toISOString()).toBe(env.occurredAt);
    expect(env.payload).toEqual({ videoId: 'v1' });
    expect(env.correlationId).toHaveLength(36);
  });

  it('keeps the provided correlationId', () => {
    const env = createEnvelope('video.failed', { videoId: 'v1' }, 'corr-123');
    expect(env.correlationId).toBe('corr-123');
  });

  it('round-trips through parseEnvelope', () => {
    const env = createEnvelope('video.processed', { videoId: 'v1' });
    const parsed = parseEnvelope<{ videoId: string }>(Buffer.from(JSON.stringify(env)));
    expect(parsed).toEqual(env);
  });

  it('rejects malformed json', () => {
    expect(() => parseEnvelope('not-json')).toThrow(InvalidEventError);
  });

  it('rejects an object missing required envelope fields', () => {
    expect(() => parseEnvelope(JSON.stringify({ payload: {} }))).toThrow(InvalidEventError);
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -w @fiapx/shared`
Expected: FAIL — módulos `../../src/events` inexistentes.

- [ ] **Step 3: Criar `package.json`, `tsconfig.json` e `jest.config.js` do pacote**

```json
{
  "name": "@fiapx/shared",
  "version": "1.0.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "jest",
    "test:unit": "jest"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.712.0",
    "@aws-sdk/lib-storage": "^3.712.0",
    "amqplib": "^0.10.5",
    "ioredis": "^5.4.2",
    "pino": "^9.5.0",
    "uuid": "^11.0.3"
  },
  "devDependencies": {
    "@types/amqplib": "^0.10.6",
    "@types/jest": "^29.5.14",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5"
  }
}
```

`jest.config.js`:

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/index.ts'],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};
```

`tsconfig.json`: `{ "extends": "../../tsconfig.base.json", "compilerOptions": { "outDir": "dist", "rootDir": "src" }, "include": ["src"] }`

- [ ] **Step 4: Implementar erros**

`src/errors/index.ts`:

```ts
export class AppError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 500,
    readonly code: string = 'INTERNAL_ERROR',
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Invalid credentials') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class InvalidEventError extends AppError {
  constructor(message: string) {
    super(message, 422, 'INVALID_EVENT');
  }
}
```

- [ ] **Step 5: Implementar envelope, routing keys e payloads**

`src/events/envelope.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { InvalidEventError } from '../errors/index.js';

export interface EventEnvelope<T> {
  eventId: string;
  eventType: string;
  occurredAt: string;
  correlationId: string;
  payload: T;
}

export function createEnvelope<T>(
  eventType: string,
  payload: T,
  correlationId: string = randomUUID(),
): EventEnvelope<T> {
  return {
    eventId: randomUUID(),
    eventType,
    occurredAt: new Date().toISOString(),
    correlationId,
    payload,
  };
}

export function parseEnvelope<T>(raw: Buffer | string): EventEnvelope<T> {
  let candidate: unknown;
  try {
    candidate = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8'));
  } catch {
    throw new InvalidEventError('Event body is not valid JSON');
  }

  if (typeof candidate !== 'object' || candidate === null) {
    throw new InvalidEventError('Event body is not an object');
  }

  const env = candidate as Partial<EventEnvelope<T>>;
  for (const field of ['eventId', 'eventType', 'occurredAt', 'correlationId'] as const) {
    if (typeof env[field] !== 'string') {
      throw new InvalidEventError(`Event envelope is missing "${field}"`);
    }
  }
  if (env.payload === undefined) {
    throw new InvalidEventError('Event envelope is missing "payload"');
  }
  return env as EventEnvelope<T>;
}
```

`src/events/routing-keys.ts`:

```ts
export const ROUTING_KEYS = {
  VIDEO_UPLOADED: 'video.uploaded',
  VIDEO_PROCESSING_STARTED: 'video.processing.started',
  VIDEO_PROCESSED: 'video.processed',
  VIDEO_FAILED: 'video.failed',
} as const;

export type RoutingKey = (typeof ROUTING_KEYS)[keyof typeof ROUTING_KEYS];
```

`src/events/payloads.ts`:

```ts
export interface VideoUploadedPayload {
  videoId: string;
  userId: string;
  userEmail: string;
  storageKey: string;
  originalName: string;
  frameIntervalSeconds: number;
}

export interface VideoProcessingStartedPayload {
  videoId: string;
}

export interface VideoProcessedPayload {
  videoId: string;
  userEmail: string;
  originalName: string;
  zipKey: string;
  frameCount: number;
  durationMs: number;
  sizeBytes: number;
}

export interface VideoFailedPayload {
  videoId: string;
  userEmail: string;
  originalName: string;
  reason: string;
  attempt: number;
}
```

`src/events/index.ts` reexporta os três arquivos.

- [ ] **Step 6: Implementar o logger**

`src/logger/index.ts`:

```ts
import pino, { type Logger } from 'pino';

export type { Logger };

export function createLogger(name: string): Logger {
  return pino({
    name,
    level: process.env.LOG_LEVEL ?? 'info',
    base: { service: name },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: ['req.headers.authorization', 'password', '*.password'],
  });
}
```

- [ ] **Step 7: Rodar os testes**

Run: `npm test -w @fiapx/shared`
Expected: PASS — 5 testes verdes.

- [ ] **Step 8: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add event envelope, domain errors and pino logger"
```

---

### Task 3: `packages/shared` — cliente RabbitMQ com topologia, confirms e retry

**Files:**
- Create: `packages/shared/src/messaging/topology.ts`, `messaging/connection.ts`, `messaging/publisher.ts`, `messaging/consumer.ts`, `messaging/index.ts`
- Test: `packages/shared/tests/messaging/topology.test.ts`, `tests/messaging/consumer.test.ts`

**Interfaces:**
- Consumes: `createEnvelope`, `parseEnvelope`, `EventEnvelope`, `createLogger` (Task 2)
- Produces:
  - `buildTopology(exchange: string): TopologyPlan` — descreve exchange, filas, bindings e argumentos de retry/DLQ
  - `RETRY_DELAYS_MS = [30_000, 120_000, 600_000]`
  - `nextRetryDelay(attempt: number): number | null` — `null` quando esgotou
  - `class RabbitConnection { static connect(url: string, logger: Logger): Promise<RabbitConnection>; createPublisher(exchange): Promise<EventPublisher>; consume(opts: ConsumeOptions): Promise<void>; close(): Promise<void> }`
  - `interface EventPublisher { publish<T>(routingKey: string, payload: T, correlationId?: string): Promise<void> }`
  - `interface ConsumeOptions { queue: string; exchange: string; routingKeys: string[]; prefetch?: number; handler: (env: EventEnvelope<unknown>, attempt: number) => Promise<void> }`

- [ ] **Step 1: Escrever os testes que falham**

`tests/messaging/topology.test.ts`:

```ts
import { buildTopology, nextRetryDelay, RETRY_DELAYS_MS } from '../../src/messaging/topology';

describe('topology', () => {
  const plan = buildTopology('video-events');

  it('declares a durable topic exchange plus retry and dlq exchanges', () => {
    expect(plan.exchanges).toEqual([
      { name: 'video-events', type: 'topic', durable: true },
      { name: 'video-events.retry', type: 'topic', durable: true },
      { name: 'video-events.dlx', type: 'topic', durable: true },
    ]);
  });

  it('creates one retry queue per configured delay, dead-lettering back to the main exchange', () => {
    const retryQueues = plan.queues.filter((q) => q.name.startsWith('video-events.retry.'));
    expect(retryQueues).toHaveLength(RETRY_DELAYS_MS.length);
    expect(retryQueues[0]).toMatchObject({
      name: 'video-events.retry.30000',
      durable: true,
      args: {
        'x-message-ttl': 30_000,
        'x-dead-letter-exchange': 'video-events',
      },
    });
  });

  it('creates a dead letter queue', () => {
    expect(plan.queues).toContainEqual(
      expect.objectContaining({ name: 'video-events.dlq', durable: true }),
    );
  });
});

describe('nextRetryDelay', () => {
  it('walks the backoff ladder', () => {
    expect(nextRetryDelay(0)).toBe(30_000);
    expect(nextRetryDelay(1)).toBe(120_000);
    expect(nextRetryDelay(2)).toBe(600_000);
  });

  it('returns null once retries are exhausted', () => {
    expect(nextRetryDelay(3)).toBeNull();
  });
});
```

`tests/messaging/consumer.test.ts` (testa a política de despacho sem RabbitMQ real):

```ts
import { handleDelivery } from '../../src/messaging/consumer';
import { createEnvelope } from '../../src/events';

function makeMsg(body: unknown, attempt = 0) {
  return {
    content: Buffer.from(JSON.stringify(body)),
    properties: { headers: { 'x-attempt': attempt } },
    fields: { routingKey: 'video.uploaded' },
  };
}

describe('handleDelivery', () => {
  const noopRetry = jest.fn();
  beforeEach(() => noopRetry.mockReset());

  it('acks after a successful handler', async () => {
    const ack = jest.fn();
    await handleDelivery({
      msg: makeMsg(createEnvelope('video.uploaded', { videoId: 'v1' })),
      handler: async () => undefined,
      ack,
      sendToRetry: noopRetry,
      logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() } as never,
    });
    expect(ack).toHaveBeenCalledTimes(1);
    expect(noopRetry).not.toHaveBeenCalled();
  });

  it('sends the message to retry with an incremented attempt when the handler throws', async () => {
    const ack = jest.fn();
    await handleDelivery({
      msg: makeMsg(createEnvelope('video.uploaded', { videoId: 'v1' }), 1),
      handler: async () => {
        throw new Error('boom');
      },
      ack,
      sendToRetry: noopRetry,
      logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() } as never,
    });
    expect(noopRetry).toHaveBeenCalledWith(expect.anything(), 2);
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it('acks and drops a malformed message instead of retrying forever', async () => {
    const ack = jest.fn();
    await handleDelivery({
      msg: { content: Buffer.from('nope'), properties: { headers: {} }, fields: { routingKey: 'x' } },
      handler: jest.fn(),
      ack,
      sendToRetry: noopRetry,
      logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() } as never,
    });
    expect(ack).toHaveBeenCalledTimes(1);
    expect(noopRetry).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -w @fiapx/shared -- messaging`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Implementar `topology.ts`**

```ts
export const RETRY_DELAYS_MS = [30_000, 120_000, 600_000] as const;

export function nextRetryDelay(attempt: number): number | null {
  return RETRY_DELAYS_MS[attempt] ?? null;
}

export interface ExchangeSpec {
  name: string;
  type: 'topic';
  durable: true;
}

export interface QueueSpec {
  name: string;
  durable: true;
  args?: Record<string, string | number>;
}

export interface BindingSpec {
  queue: string;
  exchange: string;
  routingKey: string;
}

export interface TopologyPlan {
  exchanges: ExchangeSpec[];
  queues: QueueSpec[];
  bindings: BindingSpec[];
}

export function buildTopology(exchange: string): TopologyPlan {
  const retryExchange = `${exchange}.retry`;
  const dlx = `${exchange}.dlx`;

  const queues: QueueSpec[] = RETRY_DELAYS_MS.map((delay) => ({
    name: `${retryExchange}.${delay}`,
    durable: true,
    args: { 'x-message-ttl': delay, 'x-dead-letter-exchange': exchange },
  }));
  queues.push({ name: `${exchange}.dlq`, durable: true });

  const bindings: BindingSpec[] = RETRY_DELAYS_MS.map((delay) => ({
    queue: `${retryExchange}.${delay}`,
    exchange: retryExchange,
    routingKey: `${delay}.#`,
  }));
  bindings.push({ queue: `${exchange}.dlq`, exchange: dlx, routingKey: '#' });

  return {
    exchanges: [
      { name: exchange, type: 'topic', durable: true },
      { name: retryExchange, type: 'topic', durable: true },
      { name: dlx, type: 'topic', durable: true },
    ],
    queues,
    bindings,
  };
}
```

- [ ] **Step 4: Implementar `consumer.ts` com `handleDelivery` isolado**

```ts
import type { ConsumeMessage } from 'amqplib';
import type { Logger } from 'pino';
import { parseEnvelope, type EventEnvelope } from '../events/index.js';
import { InvalidEventError } from '../errors/index.js';

export interface DeliveryContext {
  msg: Pick<ConsumeMessage, 'content' | 'properties' | 'fields'>;
  handler: (env: EventEnvelope<unknown>, attempt: number) => Promise<void>;
  ack: () => void;
  sendToRetry: (msg: DeliveryContext['msg'], nextAttempt: number) => void;
  logger: Logger;
}

export async function handleDelivery(ctx: DeliveryContext): Promise<void> {
  const attempt = Number(ctx.msg.properties.headers?.['x-attempt'] ?? 0);
  let envelope: EventEnvelope<unknown>;

  try {
    envelope = parseEnvelope(ctx.msg.content);
  } catch (error) {
    if (error instanceof InvalidEventError) {
      ctx.logger.error({ err: error, routingKey: ctx.msg.fields.routingKey }, 'dropping malformed event');
      ctx.ack();
      return;
    }
    throw error;
  }

  try {
    await ctx.handler(envelope, attempt);
    ctx.ack();
  } catch (error) {
    ctx.logger.error(
      { err: error, eventId: envelope.eventId, attempt, correlationId: envelope.correlationId },
      'event handler failed',
    );
    ctx.sendToRetry(ctx.msg, attempt + 1);
    ctx.ack();
  }
}
```

- [ ] **Step 5: Implementar `connection.ts` e `publisher.ts`**

`connection.ts` abre a conexão com `amqplib`, cria um `ConfirmChannel`, aplica `buildTopology` (assertExchange / assertQueue / bindQueue), reconecta com backoff exponencial (1s, 2s, 4s… até 30s) e expõe `createPublisher` e `consume`. Em `consume`: `channel.prefetch(opts.prefetch ?? 1)` e delegação a `handleDelivery`. `sendToRetry` calcula `nextRetryDelay(nextAttempt - 1)`; se for `null`, publica no `${exchange}.dlx`; caso contrário publica em `${exchange}.retry` com routing key `${delay}.${routingKey}` e header `x-attempt`.

`publisher.ts` implementa `EventPublisher.publish` usando `createEnvelope`, `Buffer.from(JSON.stringify(env))`, `{ persistent: true, contentType: 'application/json', messageId: env.eventId, correlationId: env.correlationId }` e aguarda o callback de confirmação do `ConfirmChannel` antes de resolver.

- [ ] **Step 6: Rodar os testes**

Run: `npm test -w @fiapx/shared`
Expected: PASS — testes de envelope, topologia e consumer verdes.

- [ ] **Step 7: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add rabbitmq topology, confirming publisher and retry-aware consumer"
```

---

### Task 4: `packages/shared` — object storage e idempotência

**Files:**
- Create: `packages/shared/src/storage/object-storage.ts`, `storage/index.ts`
- Create: `packages/shared/src/idempotency/redis-idempotency.ts`, `idempotency/index.ts`
- Test: `packages/shared/tests/idempotency/redis-idempotency.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores além de `Logger`
- Produces:
  - `interface ObjectStorage { putStream(bucket, key, body: Readable, contentType?): Promise<{ sizeBytes: number }>; getStream(bucket, key): Promise<Readable>; head(bucket, key): Promise<{ sizeBytes: number; contentType?: string }>; ensureBuckets(buckets: string[]): Promise<void>; remove(bucket, key): Promise<void> }`
  - `createObjectStorage(config: StorageConfig): ObjectStorage`
  - `interface IdempotencyStore { markProcessed(eventId: string): Promise<boolean> }` — `true` quando é a primeira vez
  - `createRedisIdempotencyStore(redis: Redis, opts?: { prefix?: string; ttlSeconds?: number }): IdempotencyStore`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { createRedisIdempotencyStore } from '../../src/idempotency';

describe('redis idempotency store', () => {
  it('returns true the first time and false afterwards', async () => {
    const set = jest.fn().mockResolvedValueOnce('OK').mockResolvedValueOnce(null);
    const store = createRedisIdempotencyStore({ set } as never);

    await expect(store.markProcessed('evt-1')).resolves.toBe(true);
    await expect(store.markProcessed('evt-1')).resolves.toBe(false);
    expect(set).toHaveBeenCalledWith('idem:evt-1', '1', 'EX', 86_400, 'NX');
  });

  it('honours a custom prefix and ttl', async () => {
    const set = jest.fn().mockResolvedValue('OK');
    const store = createRedisIdempotencyStore({ set } as never, { prefix: 'api', ttlSeconds: 60 });
    await store.markProcessed('evt-2');
    expect(set).toHaveBeenCalledWith('api:evt-2', '1', 'EX', 60, 'NX');
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -w @fiapx/shared -- idempotency`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `redis-idempotency.ts`**

```ts
import type Redis from 'ioredis';

export interface IdempotencyStore {
  markProcessed(eventId: string): Promise<boolean>;
}

export function createRedisIdempotencyStore(
  redis: Pick<Redis, 'set'>,
  opts: { prefix?: string; ttlSeconds?: number } = {},
): IdempotencyStore {
  const prefix = opts.prefix ?? 'idem';
  const ttl = opts.ttlSeconds ?? 86_400;
  return {
    async markProcessed(eventId) {
      const result = await redis.set(`${prefix}:${eventId}`, '1', 'EX', ttl, 'NX');
      return result === 'OK';
    },
  };
}
```

- [ ] **Step 4: Implementar `object-storage.ts`**

Usa `@aws-sdk/client-s3` (`S3Client`, `HeadObjectCommand`, `GetObjectCommand`, `DeleteObjectCommand`, `CreateBucketCommand`, `HeadBucketCommand`) e `@aws-sdk/lib-storage` (`Upload`, que faz multipart em stream sem carregar em memória). `forcePathStyle` vem de `STORAGE_FORCE_PATH_STYLE` para funcionar com MinIO. `ensureBuckets` faz `HeadBucket` e cria quando recebe `NotFound`.

- [ ] **Step 5: Rodar os testes e o build**

Run: `npm test -w @fiapx/shared && npm run build -w @fiapx/shared`
Expected: PASS e `dist/` gerado.

- [ ] **Step 6: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add s3-compatible object storage and redis idempotency store"
```

---

### Task 5: `video-api` — domínio

**Files:**
- Create: `apps/video-api/package.json`, `tsconfig.json`, `jest.config.js`
- Create: `apps/video-api/src/domain/entities/user.ts`, `entities/video.ts`, `entities/video-status.ts`
- Create: `apps/video-api/src/domain/ports/{user-repository.ts,video-repository.ts,password-hasher.ts,token-service.ts,event-publisher.ts}`
- Test: `apps/video-api/tests/domain/video-status.test.ts`, `tests/domain/video.test.ts`

**Interfaces:**
- Consumes: `@fiapx/shared` (erros)
- Produces:
  - `enum VideoStatus { PENDING, PROCESSING, COMPLETED, FAILED }` (union de strings)
  - `canTransition(from: VideoStatus, to: VideoStatus): boolean`
  - `class Video` com `markProcessing()`, `markCompleted(r: { zipKey; frameCount; durationMs; sizeBytes })`, `markFailed(reason: string)`, `isDownloadable(): boolean`
  - `interface VideoRepository { save(v: Video): Promise<Video>; findByIdForUser(id, userId): Promise<Video | null>; findById(id): Promise<Video | null>; listByUser(userId, f: { status?, page, limit }): Promise<{ items: Video[]; total: number }>; appendEvent(videoId, type, payload): Promise<void>; listEvents(videoId): Promise<VideoEventRecord[]> }`
  - `interface UserRepository { create(u): Promise<User>; findByEmail(email): Promise<User | null>; findById(id): Promise<User | null> }`
  - `interface PasswordHasher { hash(plain): Promise<string>; compare(plain, hash): Promise<boolean> }`
  - `interface TokenService { sign(payload: { sub: string; email: string }): string; verify(token: string): { sub: string; email: string } }`

- [ ] **Step 1: Criar o workspace `@fiapx/video-api`**

`apps/video-api/package.json`:

```json
{
  "name": "@fiapx/video-api",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "start": "node dist/server.js",
    "dev": "tsx watch src/server.ts",
    "test": "jest --selectProjects unit",
    "test:unit": "jest --selectProjects unit",
    "test:integration": "jest --selectProjects integration --runInBand",
    "test:bdd": "cucumber-js",
    "migration:run": "typeorm-ts-node-commonjs migration:run -d src/infrastructure/database/data-source.ts",
    "migration:revert": "typeorm-ts-node-commonjs migration:revert -d src/infrastructure/database/data-source.ts"
  },
  "dependencies": {
    "@fiapx/shared": "*",
    "bcryptjs": "^2.4.3",
    "busboy": "^1.6.0",
    "cors": "^2.8.5",
    "express": "^5.0.1",
    "helmet": "^8.0.0",
    "ioredis": "^5.4.2",
    "jsonwebtoken": "^9.0.2",
    "pg": "^8.13.1",
    "pino-http": "^10.3.0",
    "prom-client": "^15.1.3",
    "reflect-metadata": "^0.2.2",
    "typeorm": "^0.3.20"
  },
  "devDependencies": {
    "@cucumber/cucumber": "^11.1.0",
    "@types/bcryptjs": "^2.4.6",
    "@types/busboy": "^1.5.4",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "testcontainers": "^10.16.0",
    "ts-jest": "^29.2.5",
    "tsx": "^4.19.2"
  }
}
```

`jest.config.js` define dois projects, para separar unit de integração:

```js
const base = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};

module.exports = {
  ...base,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/index.ts', '!src/server.ts'],
  projects: [
    { ...base, displayName: 'unit', roots: ['<rootDir>/tests'], testPathIgnorePatterns: ['/tests/integration/'] },
    { ...base, displayName: 'integration', roots: ['<rootDir>/tests/integration'], testTimeout: 120_000 },
  ],
};
```

Run: `npm install`

- [ ] **Step 2: Escrever os testes que falham**

```ts
import { VideoStatus, canTransition } from '../../src/domain/entities/video-status';
import { Video } from '../../src/domain/entities/video';

describe('canTransition', () => {
  it('allows the happy path', () => {
    expect(canTransition(VideoStatus.PENDING, VideoStatus.PROCESSING)).toBe(true);
    expect(canTransition(VideoStatus.PROCESSING, VideoStatus.COMPLETED)).toBe(true);
    expect(canTransition(VideoStatus.PROCESSING, VideoStatus.FAILED)).toBe(true);
  });

  it('allows failing straight from pending', () => {
    expect(canTransition(VideoStatus.PENDING, VideoStatus.FAILED)).toBe(true);
  });

  it('rejects moving out of a terminal state', () => {
    expect(canTransition(VideoStatus.COMPLETED, VideoStatus.PROCESSING)).toBe(false);
    expect(canTransition(VideoStatus.FAILED, VideoStatus.COMPLETED)).toBe(false);
  });

  it('rejects skipping processing', () => {
    expect(canTransition(VideoStatus.PENDING, VideoStatus.COMPLETED)).toBe(false);
  });
});

describe('Video', () => {
  const base = () =>
    new Video({
      id: 'v1',
      userId: 'u1',
      originalName: 'clip.mp4',
      storageKey: 'raw/u1/v1.mp4',
      status: VideoStatus.PENDING,
      frameIntervalSeconds: 20,
      createdAt: new Date('2026-09-01T12:00:00Z'),
      updatedAt: new Date('2026-09-01T12:00:00Z'),
    });

  it('moves to processing', () => {
    const v = base();
    v.markProcessing();
    expect(v.status).toBe(VideoStatus.PROCESSING);
  });

  it('records the result when completed', () => {
    const v = base();
    v.markProcessing();
    v.markCompleted({ zipKey: 'zips/v1.zip', frameCount: 12, durationMs: 240_000, sizeBytes: 900 });
    expect(v.status).toBe(VideoStatus.COMPLETED);
    expect(v.zipKey).toBe('zips/v1.zip');
    expect(v.frameCount).toBe(12);
    expect(v.isDownloadable()).toBe(true);
  });

  it('records the reason when failed', () => {
    const v = base();
    v.markFailed('ffmpeg exited with code 1');
    expect(v.status).toBe(VideoStatus.FAILED);
    expect(v.errorReason).toBe('ffmpeg exited with code 1');
    expect(v.isDownloadable()).toBe(false);
  });

  it('ignores an out-of-order transition instead of throwing', () => {
    const v = base();
    v.markProcessing();
    v.markCompleted({ zipKey: 'z', frameCount: 1, durationMs: 1, sizeBytes: 1 });
    v.markProcessing();
    expect(v.status).toBe(VideoStatus.COMPLETED);
  });
});
```

- [ ] **Step 3: Rodar e confirmar falha**

Run: `npm test -w @fiapx/video-api`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 4: Implementar `video-status.ts`**

```ts
export const VideoStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export type VideoStatus = (typeof VideoStatus)[keyof typeof VideoStatus];

const ALLOWED: Record<VideoStatus, VideoStatus[]> = {
  PENDING: [VideoStatus.PROCESSING, VideoStatus.FAILED],
  PROCESSING: [VideoStatus.COMPLETED, VideoStatus.FAILED],
  COMPLETED: [],
  FAILED: [],
};

export function canTransition(from: VideoStatus, to: VideoStatus): boolean {
  return ALLOWED[from].includes(to);
}
```

- [ ] **Step 5: Implementar `video.ts` e `user.ts`**

`Video` guarda os campos do schema, aplica `canTransition` em cada mutação e **ignora silenciosamente** transições inválidas (retorna `false`), conforme a spec. `isDownloadable()` é `status === COMPLETED && zipKey != null`.

- [ ] **Step 6: Declarar as portas em `src/domain/ports/`**

Somente interfaces TypeScript, sem implementação — as assinaturas exatas estão no bloco *Produces* desta task.

- [ ] **Step 7: Rodar os testes**

Run: `npm test -w @fiapx/video-api`
Expected: PASS — 9 testes verdes.

- [ ] **Step 8: Commit**

```bash
git add apps/video-api
git commit -m "feat(video-api): add domain entities, status machine and repository ports"
```

---

### Task 6: `video-api` — persistência com TypeORM

**Files:**
- Create: `apps/video-api/src/infrastructure/database/data-source.ts`, `database/entities/{user.entity.ts,video.entity.ts,video-event.entity.ts}`, `database/migrations/1756700000000-InitialSchema.ts`
- Create: `apps/video-api/src/infrastructure/repositories/{typeorm-user-repository.ts,typeorm-video-repository.ts}`
- Test: `apps/video-api/tests/integration/typeorm-video-repository.test.ts`

**Interfaces:**
- Consumes: `VideoRepository`, `UserRepository`, `Video`, `User`, `VideoStatus` (Task 5)
- Produces: `createDataSource(config): DataSource`, `TypeOrmVideoRepository`, `TypeOrmUserRepository`, migração `InitialSchema`

- [ ] **Step 1: Escrever o teste de integração que falha**

Usa `testcontainers` para subir `postgres:17-alpine`, roda as migrações e exercita: `save` → `findByIdForUser` → `listByUser` com filtro de status e paginação → `appendEvent`/`listEvents` → isolamento (`findByIdForUser` de outro usuário devolve `null`).

```ts
it('never returns a video that belongs to another user', async () => {
  const saved = await repo.save(makeVideo({ userId: 'user-a' }));
  await expect(repo.findByIdForUser(saved.id, 'user-b')).resolves.toBeNull();
  await expect(repo.findByIdForUser(saved.id, 'user-a')).resolves.not.toBeNull();
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm run test:integration -w @fiapx/video-api`
Expected: FAIL — repositório inexistente. (Requer Docker em execução.)

- [ ] **Step 3: Criar as entidades TypeORM e a migração**

A migração `InitialSchema` executa exatamente este DDL no `up`, e `DROP TABLE` na ordem inversa no `down`:

```sql
CREATE SCHEMA IF NOT EXISTS video;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE video.users (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          varchar(120) NOT NULL,
  email         citext NOT NULL UNIQUE,
  password_hash varchar(120) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE video.video_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE video.videos (
  id                     uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                uuid NOT NULL REFERENCES video.users(id) ON DELETE CASCADE,
  original_name          varchar(255) NOT NULL,
  storage_key            varchar(512) NOT NULL,
  zip_key                varchar(512),
  status                 video.video_status NOT NULL DEFAULT 'PENDING',
  frame_count            integer,
  duration_ms            integer,
  size_bytes             bigint,
  frame_interval_seconds integer NOT NULL DEFAULT 20,
  error_reason           text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE video.video_events (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id   uuid NOT NULL REFERENCES video.videos(id) ON DELETE CASCADE,
  type       varchar(64) NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_videos_user_created ON video.videos (user_id, created_at DESC);
CREATE INDEX idx_videos_status       ON video.videos (status);
CREATE INDEX idx_video_events_video  ON video.video_events (video_id, created_at);
```

As entidades TypeORM espelham essas tabelas com `{ schema: 'video' }` e `synchronize: false` —
o schema é sempre governado pela migração, nunca inferido.

- [ ] **Step 4: Implementar os repositórios**

Mapeiam entidade de persistência ↔ entidade de domínio em funções `toDomain` / `toPersistence` dedicadas — o domínio nunca importa TypeORM.

- [ ] **Step 5: Rodar os testes**

Run: `npm run test:integration -w @fiapx/video-api`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/video-api
git commit -m "feat(video-api): add typeorm persistence with initial migration"
```

---

### Task 7: `video-api` — autenticação

**Files:**
- Create: `apps/video-api/src/application/use-cases/{register-user.ts,authenticate-user.ts,get-current-user.ts}`
- Create: `apps/video-api/src/infrastructure/auth/{bcrypt-password-hasher.ts,jwt-token-service.ts}`
- Create: `apps/video-api/src/interface/http/controllers/auth-controller.ts`, `middlewares/{authenticate.ts,error-handler.ts,request-context.ts}`
- Test: `apps/video-api/tests/application/register-user.test.ts`, `tests/application/authenticate-user.test.ts`, `tests/interface/authenticate-middleware.test.ts`

**Interfaces:**
- Consumes: `UserRepository`, `PasswordHasher`, `TokenService`, `ValidationError`, `UnauthorizedError`
- Produces:
  - `class RegisterUserUseCase { execute(i: { name; email; password }): Promise<{ id; name; email; token }> }`
  - `class AuthenticateUserUseCase { execute(i: { email; password }): Promise<{ id; name; email; token }> }`
  - `authenticate(tokenService): RequestHandler` — popula `req.auth = { userId, email }`
  - `errorHandler: ErrorRequestHandler` — mapeia `AppError` para `{ error: { code, message } }` com o `statusCode`

- [ ] **Step 1: Escrever os testes que falham**

```ts
describe('RegisterUserUseCase', () => {
  it('rejects an e-mail that is already registered', async () => {
    const users = { findByEmail: jest.fn().mockResolvedValue({ id: 'u1' }), create: jest.fn() };
    const useCase = new RegisterUserUseCase(users as never, hasher, tokens);
    await expect(useCase.execute({ name: 'A', email: 'a@b.c', password: 'secret123' }))
      .rejects.toThrow(ValidationError);
    expect(users.create).not.toHaveBeenCalled();
  });

  it('rejects a password shorter than 8 characters', async () => {
    await expect(useCase.execute({ name: 'A', email: 'a@b.c', password: 'short' }))
      .rejects.toThrow(ValidationError);
  });

  it('stores the hash, never the plain password', async () => {
    await useCase.execute({ name: 'A', email: 'a@b.c', password: 'secret123' });
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: 'hashed:secret123' }),
    );
  });

  it('normalises the e-mail to lower case and trims it', async () => {
    await useCase.execute({ name: 'A', email: '  A@B.C  ', password: 'secret123' });
    expect(users.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'a@b.c' }));
  });
});

describe('AuthenticateUserUseCase', () => {
  it('throws the same error for unknown e-mail and wrong password', async () => {
    const missing = new AuthenticateUserUseCase(
      { findByEmail: jest.fn().mockResolvedValue(null) } as never, hasher, tokens);
    const wrong = new AuthenticateUserUseCase(
      { findByEmail: jest.fn().mockResolvedValue(user) } as never,
      { ...hasher, compare: jest.fn().mockResolvedValue(false) } as never, tokens);

    await expect(missing.execute({ email: 'a@b.c', password: 'x' })).rejects.toThrow(UnauthorizedError);
    await expect(wrong.execute({ email: 'a@b.c', password: 'x' })).rejects.toThrow(UnauthorizedError);
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -w @fiapx/video-api -- application`
Expected: FAIL.

- [ ] **Step 3: Implementar os casos de uso e adaptadores**

`BcryptPasswordHasher` com custo 12; `JwtTokenService` com HS256, `JWT_SECRET` e `JWT_EXPIRES_IN`. A mensagem de erro de login é sempre `Invalid credentials`, independente da causa.

- [ ] **Step 4: Implementar o controller, o middleware e as rotas**

`POST /auth/register`, `POST /auth/login`, `GET /me`. O middleware lê `Authorization: Bearer <token>`, verifica e popula `req.auth`.

- [ ] **Step 5: Rodar os testes**

Run: `npm test -w @fiapx/video-api`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/video-api
git commit -m "feat(video-api): add user registration, login and jwt middleware"
```

---

### Task 8: `video-api` — upload em stream e publicação do evento

**Files:**
- Create: `apps/video-api/src/application/use-cases/upload-video.ts`
- Create: `apps/video-api/src/infrastructure/messaging/rabbit-event-publisher.ts`
- Create: `apps/video-api/src/interface/http/controllers/video-controller.ts` (ação de upload)
- Test: `apps/video-api/tests/application/upload-video.test.ts`

**Interfaces:**
- Consumes: `VideoRepository`, `ObjectStorage`, `EventPublisher`, `Video`, `ROUTING_KEYS`, `VideoUploadedPayload`
- Produces: `class UploadVideoUseCase { execute(i: { userId; userEmail; originalName; mimeType; stream: Readable; frameIntervalSeconds?: number }): Promise<Video> }`

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('rejects an unsupported extension before touching storage', async () => {
  await expect(useCase.execute({ ...input, originalName: 'notes.pdf' })).rejects.toThrow(ValidationError);
  expect(storage.putStream).not.toHaveBeenCalled();
});

it('stores the object under raw/<userId>/<videoId>.<ext>', async () => {
  const video = await useCase.execute(input);
  expect(storage.putStream).toHaveBeenCalledWith(
    'fiapx-raw', `raw/u1/${video.id}.mp4`, input.stream, 'video/mp4',
  );
});

it('persists the video as PENDING and publishes video.uploaded', async () => {
  const video = await useCase.execute(input);
  expect(video.status).toBe(VideoStatus.PENDING);
  expect(publisher.publish).toHaveBeenCalledWith('video.uploaded', expect.objectContaining({
    videoId: video.id, userId: 'u1', storageKey: video.storageKey, frameIntervalSeconds: 20,
  }));
});

it('marks the video as FAILED when publishing fails, so it never sits stuck in PENDING', async () => {
  publisher.publish.mockRejectedValueOnce(new Error('broker down'));
  await expect(useCase.execute(input)).rejects.toThrow('broker down');
  expect(repo.save).toHaveBeenLastCalledWith(expect.objectContaining({ status: VideoStatus.FAILED }));
});

it('falls back to the configured default frame interval', async () => {
  const video = await useCase.execute({ ...input, frameIntervalSeconds: undefined });
  expect(video.frameIntervalSeconds).toBe(20);
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -w @fiapx/video-api -- upload-video`
Expected: FAIL.

- [ ] **Step 3: Implementar `UploadVideoUseCase`**

Ordem: valida extensão e intervalo → gera `videoId` → `storage.putStream` → `repo.save(PENDING)` → `repo.appendEvent(videoId, 'uploaded', …)` → `publisher.publish`. Falha na publicação marca o vídeo como `FAILED` e repropaga o erro.

- [ ] **Step 4: Implementar a rota de upload com `busboy`**

O controller conecta o stream do arquivo direto ao caso de uso, sem escrever em disco. Aborta com `413` quando `MAX_UPLOAD_BYTES` é excedido. Responde `202` com `{ id, status, originalName, createdAt }`.

- [ ] **Step 5: Rodar os testes**

Run: `npm test -w @fiapx/video-api`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/video-api
git commit -m "feat(video-api): stream uploads to object storage and publish video.uploaded"
```

---

### Task 9: `video-api` — listagem, detalhe e download

**Files:**
- Create: `apps/video-api/src/application/use-cases/{list-videos.ts,get-video.ts,download-video-zip.ts}`
- Modify: `apps/video-api/src/interface/http/controllers/video-controller.ts`
- Create: `apps/video-api/src/interface/http/routes.ts`
- Test: `apps/video-api/tests/application/{list-videos.test.ts,download-video-zip.test.ts}`

**Interfaces:**
- Consumes: `VideoRepository`, `ObjectStorage`, `NotFoundError`
- Produces:
  - `class ListVideosUseCase { execute(i: { userId; status?; page?; limit? }): Promise<{ items: VideoSummary[]; total; page; limit }> }`
  - `class GetVideoUseCase { execute(i: { userId; videoId }): Promise<{ video: Video; events: VideoEventRecord[] }> }`
  - `class DownloadVideoZipUseCase { execute(i: { userId; videoId }): Promise<{ stream: Readable; filename: string; sizeBytes: number }> }`

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('clamps limit to 100 and page to at least 1', async () => {
  await useCase.execute({ userId: 'u1', limit: 5000, page: 0 });
  expect(repo.listByUser).toHaveBeenCalledWith('u1', { status: undefined, page: 1, limit: 100 });
});

it('rejects an unknown status filter', async () => {
  await expect(useCase.execute({ userId: 'u1', status: 'BANANA' })).rejects.toThrow(ValidationError);
});

it('throws NotFound when the video belongs to someone else', async () => {
  repo.findByIdForUser.mockResolvedValue(null);
  await expect(download.execute({ userId: 'u2', videoId: 'v1' })).rejects.toThrow(NotFoundError);
});

it('refuses to download a video that is still processing', async () => {
  repo.findByIdForUser.mockResolvedValue(processingVideo);
  await expect(download.execute({ userId: 'u1', videoId: 'v1' })).rejects.toThrow(ValidationError);
});

it('names the zip after the original file', async () => {
  const result = await download.execute({ userId: 'u1', videoId: 'v1' });
  expect(result.filename).toBe('clip-frames.zip');
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -w @fiapx/video-api -- list-videos download-video-zip`
Expected: FAIL.

- [ ] **Step 3: Implementar os três casos de uso**

- [ ] **Step 4: Ligar as rotas em `routes.ts`**

`GET /videos`, `GET /videos/:id`, `GET /videos/:id/download` (define `Content-Type: application/zip`, `Content-Length` e `Content-Disposition: attachment`), todas atrás de `authenticate`.

- [ ] **Step 5: Rodar os testes**

Run: `npm test -w @fiapx/video-api`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/video-api
git commit -m "feat(video-api): add video listing, detail and zip download endpoints"
```

---

### Task 10: `video-api` — consumidores de eventos de resultado

**Files:**
- Create: `apps/video-api/src/application/use-cases/apply-processing-event.ts`
- Create: `apps/video-api/src/infrastructure/messaging/video-events-consumer.ts`
- Test: `apps/video-api/tests/application/apply-processing-event.test.ts`

**Interfaces:**
- Consumes: `VideoRepository`, `IdempotencyStore`, `EventEnvelope`, `ROUTING_KEYS`, payloads (Task 2)
- Produces: `class ApplyProcessingEventUseCase { execute(env: EventEnvelope<unknown>): Promise<void> }`; `startVideoEventsConsumer(deps): Promise<void>` (fila `video-api.video-events`)

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('ignores an event whose id was already processed', async () => {
  idempotency.markProcessed.mockResolvedValue(false);
  await useCase.execute(createEnvelope(ROUTING_KEYS.VIDEO_PROCESSED, payload));
  expect(repo.save).not.toHaveBeenCalled();
});

it('moves the video to PROCESSING on video.processing.started', async () => {
  await useCase.execute(createEnvelope(ROUTING_KEYS.VIDEO_PROCESSING_STARTED, { videoId: 'v1' }));
  expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: VideoStatus.PROCESSING }));
});

it('stores the zip metadata on video.processed', async () => {
  await useCase.execute(createEnvelope(ROUTING_KEYS.VIDEO_PROCESSED, {
    videoId: 'v1', zipKey: 'zips/v1.zip', frameCount: 7, durationMs: 140_000, sizeBytes: 4096,
  }));
  expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
    status: VideoStatus.COMPLETED, zipKey: 'zips/v1.zip', frameCount: 7,
  }));
});

it('does nothing when the video no longer exists', async () => {
  repo.findById.mockResolvedValue(null);
  await expect(useCase.execute(createEnvelope(ROUTING_KEYS.VIDEO_FAILED, failPayload))).resolves.toBeUndefined();
  expect(repo.save).not.toHaveBeenCalled();
});

it('appends every applied event to the video timeline', async () => {
  await useCase.execute(createEnvelope(ROUTING_KEYS.VIDEO_FAILED, failPayload));
  expect(repo.appendEvent).toHaveBeenCalledWith('v1', 'video.failed', failPayload);
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -w @fiapx/video-api -- apply-processing-event`
Expected: FAIL.

- [ ] **Step 3: Implementar o caso de uso e o consumidor**

- [ ] **Step 4: Rodar os testes**

Run: `npm test -w @fiapx/video-api`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/video-api
git commit -m "feat(video-api): consume processing events and update video status idempotently"
```

---

### Task 11: `video-api` — bootstrap, saúde, métricas e imagem

**Files:**
- Create: `apps/video-api/src/config.ts`, `src/app.ts`, `src/server.ts`, `src/container.ts`
- Create: `apps/video-api/src/interface/http/controllers/health-controller.ts`, `src/infrastructure/metrics/registry.ts`
- Create: `apps/video-api/Dockerfile`, `.dockerignore`
- Test: `apps/video-api/tests/interface/health.test.ts`

**Interfaces:**
- Consumes: tudo das Tasks 5–10
- Produces: `buildApp(deps): Express`, `loadConfig(env = process.env): Config`, `registry` do prom-client com `videos_uploaded_total`, `videos_processed_total`, `video_processing_failures_total`, `http_request_duration_seconds`

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('reports liveness without touching dependencies', async () => {
  const res = await request(app).get('/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: 'ok' });
});

it('reports 503 when a dependency is down', async () => {
  checks.postgres.mockResolvedValue(false);
  const res = await request(app).get('/health/ready');
  expect(res.status).toBe(503);
  expect(res.body.checks.postgres).toBe(false);
});

it('exposes prometheus metrics', async () => {
  const res = await request(app).get('/metrics');
  expect(res.headers['content-type']).toContain('text/plain');
  expect(res.text).toContain('videos_uploaded_total');
});

it('rejects an unauthenticated request to /videos', async () => {
  await expect(request(app).get('/videos')).resolves.toMatchObject({ status: 401 });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -w @fiapx/video-api -- health`
Expected: FAIL.

- [ ] **Step 3: Implementar config, container, app e server**

`loadConfig` valida as variáveis obrigatórias e falha rápido com mensagem clara. `app.ts` monta helmet, cors, `request-context` (gera `correlationId`), `pino-http`, rotas e `errorHandler`. `server.ts` conecta Postgres, Redis, RabbitMQ e MinIO, garante os buckets, inicia o consumidor e trata `SIGTERM`.

- [ ] **Step 4: Escrever o `Dockerfile` multi-stage**

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/video-api/package.json apps/video-api/
RUN npm ci
COPY packages/shared packages/shared
COPY apps/video-api apps/video-api
RUN npm run build -w @fiapx/shared && npm run build -w @fiapx/video-api

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/video-api/package.json apps/video-api/
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/apps/video-api/dist apps/video-api/dist
USER node
EXPOSE 3000
CMD ["node", "apps/video-api/dist/server.js"]
```

- [ ] **Step 5: Rodar os testes e o build da imagem**

Run: `npm test -w @fiapx/video-api && docker build -f apps/video-api/Dockerfile -t fiapx/video-api:dev .`
Expected: PASS e imagem construída.

- [ ] **Step 6: Commit**

```bash
git add apps/video-api
git commit -m "feat(video-api): add bootstrap, health, metrics and container image"
```

---

### Task 12: `video-processor` — extração de frames

**Files:**
- Create: `apps/video-processor/package.json`, `tsconfig.json`, `jest.config.js`
- Create: `apps/video-processor/src/domain/ports/{frame-extractor.ts,archiver.ts}`
- Create: `apps/video-processor/src/infrastructure/ffmpeg/{ffmpeg-frame-extractor.ts,build-ffmpeg-args.ts}`
- Create: `apps/video-processor/src/infrastructure/archive/zip-archiver.ts`
- Test: `apps/video-processor/tests/infrastructure/build-ffmpeg-args.test.ts`

**Interfaces:**
- Consumes: `@fiapx/shared`
- Produces:
  - `buildFfmpegArgs(i: { inputPath; outputDir; frameIntervalSeconds }): string[]`
  - `interface FrameExtractor { extract(i: { inputPath; outputDir; frameIntervalSeconds }): Promise<{ frameCount: number; durationMs: number }> }`
  - `interface ZipArchiver { archive(i: { sourceDir; onEntry?: (name: string) => void }): Readable }`

- [ ] **Step 1: Escrever o teste que falha**

```ts
describe('buildFfmpegArgs', () => {
  it('extracts one frame every N seconds as jpeg', () => {
    const args = buildFfmpegArgs({ inputPath: '/tmp/in.mp4', outputDir: '/tmp/out', frameIntervalSeconds: 20 });
    expect(args).toEqual([
      '-hide_banner', '-loglevel', 'error', '-nostdin',
      '-i', '/tmp/in.mp4',
      '-vf', 'fps=1/20',
      '-q:v', '2',
      '-f', 'image2',
      '/tmp/out/frame-%05d.jpg',
    ]);
  });

  it('rejects a non-positive interval', () => {
    expect(() => buildFfmpegArgs({ inputPath: 'a', outputDir: 'b', frameIntervalSeconds: 0 })).toThrow();
  });

  it('rejects an interval above one hour', () => {
    expect(() => buildFfmpegArgs({ inputPath: 'a', outputDir: 'b', frameIntervalSeconds: 3601 })).toThrow();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -w @fiapx/video-processor`
Expected: FAIL.

- [ ] **Step 3: Implementar `buildFfmpegArgs`, o extractor e o archiver**

O extractor usa `spawn` (nunca `exec`, para não passar por shell), captura `stderr`, rejeita com o código de saída, conta os arquivos gerados e obtém a duração via `ffprobe -v error -show_entries format=duration -of csv=p=0`. O archiver usa `archiver` em modo `zip` com `zlib.level: 6` e devolve um `Readable`.

- [ ] **Step 4: Rodar os testes**

Run: `npm test -w @fiapx/video-processor`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/video-processor
git commit -m "feat(video-processor): add ffmpeg frame extraction and zip archiving"
```

---

### Task 13: `video-processor` — caso de uso, worker e imagem

**Files:**
- Create: `apps/video-processor/src/application/process-video.ts`
- Create: `apps/video-processor/src/infrastructure/messaging/consumer.ts`
- Create: `apps/video-processor/src/{config.ts,worker.ts}`, `src/interface/health-server.ts`
- Create: `apps/video-processor/Dockerfile`
- Test: `apps/video-processor/tests/application/process-video.test.ts`

**Interfaces:**
- Consumes: `FrameExtractor`, `ZipArchiver`, `ObjectStorage`, `EventPublisher`, `IdempotencyStore`, `VideoUploadedPayload`
- Produces: `class ProcessVideoUseCase { execute(env: EventEnvelope<VideoUploadedPayload>): Promise<void> }`

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('publishes processing.started before doing any heavy work', async () => {
  await useCase.execute(envelope);
  expect(publisher.publish.mock.calls[0][0]).toBe('video.processing.started');
});

it('uploads the zip and publishes video.processed with the frame count', async () => {
  extractor.extract.mockResolvedValue({ frameCount: 9, durationMs: 180_000 });
  storage.putStream.mockResolvedValue({ sizeBytes: 12_345 });

  await useCase.execute(envelope);

  expect(storage.putStream).toHaveBeenCalledWith('fiapx-zips', 'zips/u1/v1.zip', expect.anything(), 'application/zip');
  expect(publisher.publish).toHaveBeenCalledWith('video.processed', {
    videoId: 'v1', userEmail: 'user@fiapx.local', originalName: 'clip.mp4',
    zipKey: 'zips/u1/v1.zip', frameCount: 9, durationMs: 180_000, sizeBytes: 12_345,
  }, envelope.correlationId);
});

it('publishes video.failed and rethrows so the message is retried', async () => {
  extractor.extract.mockRejectedValue(new Error('ffmpeg exited with code 1'));
  await expect(useCase.execute(envelope)).rejects.toThrow('ffmpeg exited with code 1');
  expect(publisher.publish).toHaveBeenCalledWith('video.failed',
    expect.objectContaining({ videoId: 'v1', reason: 'ffmpeg exited with code 1' }), envelope.correlationId);
});

it('fails the video when no frame could be extracted', async () => {
  extractor.extract.mockResolvedValue({ frameCount: 0, durationMs: 1000 });
  await expect(useCase.execute(envelope)).rejects.toThrow(/no frames/i);
});

it('always removes the temporary directory', async () => {
  extractor.extract.mockRejectedValue(new Error('boom'));
  await expect(useCase.execute(envelope)).rejects.toThrow();
  expect(fsCleanup).toHaveBeenCalled();
});

it('skips work when the event was already processed', async () => {
  idempotency.markProcessed.mockResolvedValue(false);
  await useCase.execute(envelope);
  expect(extractor.extract).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -w @fiapx/video-processor -- process-video`
Expected: FAIL.

- [ ] **Step 3: Implementar `ProcessVideoUseCase`**

Ciclo completo da seção 4.2 da spec, com `try/finally` para `rm(tmpDir, { recursive: true, force: true })` e observação do histograma `video_processing_duration_seconds`.

- [ ] **Step 4: Implementar `worker.ts`, o health server e o `Dockerfile`**

O `Dockerfile` parte de `node:22-alpine` e adiciona `RUN apk add --no-cache ffmpeg`. O health server expõe `/health` e `/metrics` numa porta interna para o probe do Kubernetes.

- [ ] **Step 5: Rodar os testes e o build**

Run: `npm test -w @fiapx/video-processor && docker build -f apps/video-processor/Dockerfile -t fiapx/video-processor:dev .`
Expected: PASS e imagem construída.

- [ ] **Step 6: Commit**

```bash
git add apps/video-processor
git commit -m "feat(video-processor): add processing use case, worker bootstrap and image"
```

---

### Task 14: `notification-service`

**Files:**
- Create: `apps/notification-service/package.json`, `tsconfig.json`, `jest.config.js`
- Create: `apps/notification-service/src/domain/ports/mailer.ts`
- Create: `apps/notification-service/src/application/{notify-video-failed.ts,notify-video-processed.ts}`, `src/application/templates/{failure.ts,success.ts}`
- Create: `apps/notification-service/src/infrastructure/{nodemailer-mailer.ts,messaging/consumer.ts,video-lookup.ts}`
- Create: `apps/notification-service/src/{config.ts,worker.ts}`, `Dockerfile`
- Test: `apps/notification-service/tests/application/notify-video-failed.test.ts`, `tests/application/templates.test.ts`

**Interfaces:**
- Consumes: `EventEnvelope`, `VideoFailedPayload`, `VideoProcessedPayload`, `IdempotencyStore`
- Produces:
  - `interface Mailer { send(m: { to: string; subject: string; text: string; html: string }): Promise<void> }`
  - `class NotifyVideoFailedUseCase { execute(env: EventEnvelope<VideoFailedPayload>): Promise<void> }`
  - `renderFailureEmail(i: { name; originalName; reason; appUrl; videoId }): { subject; text; html }`

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('sends one e-mail to the video owner', async () => {
  await useCase.execute(envelope);
  expect(mailer.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'user@fiapx.local' }));
});

it('does not send twice for the same event', async () => {
  idempotency.markProcessed.mockResolvedValue(false);
  await useCase.execute(envelope);
  expect(mailer.send).not.toHaveBeenCalled();
});

it('escapes html in the failure reason', () => {
  const mail = renderFailureEmail({
    name: 'Ana', originalName: 'a.mp4', reason: '<script>alert(1)</script>',
    appUrl: 'http://localhost:8080', videoId: 'v1',
  });
  expect(mail.html).not.toContain('<script>');
  expect(mail.html).toContain('&lt;script&gt;');
});

it('names the video in the subject', () => {
  const mail = renderFailureEmail({ name: 'Ana', originalName: 'ferias.mp4', reason: 'x', appUrl: 'u', videoId: 'v1' });
  expect(mail.subject).toBe('Falha ao processar "ferias.mp4"');
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -w @fiapx/notification-service`
Expected: FAIL.

- [ ] **Step 3: Implementar templates, casos de uso, mailer e worker**

Os templates são funções puras. O destinatário vem do `userEmail` presente no payload de `video.uploaded`, propagado pela `video-api` — o `notification-service` não acessa o banco.

- [ ] **Step 4: Rodar os testes e o build da imagem**

Run: `npm test -w @fiapx/notification-service && docker build -f apps/notification-service/Dockerfile -t fiapx/notification:dev .`
Expected: PASS e imagem construída.

- [ ] **Step 5: Commit**

```bash
git add apps/notification-service
git commit -m "feat(notification): notify users by e-mail on processing failure and success"
```

---

### Task 15: `web` — fundação, tokens e layout

**Files:**
- Create: `apps/web/package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `nginx.conf`, `Dockerfile`
- Create: `apps/web/src/styles/{reset.css,tokens.css,app.css}`
- Create: `apps/web/src/components/{Button.tsx,Field.tsx,StatusPill.tsx,EmptyState.tsx,Spinner.tsx,Toast.tsx}`
- Create: `apps/web/src/components/AppShell.tsx`, `src/main.tsx`, `src/App.tsx`
- Test: `apps/web/tests/StatusPill.test.tsx`

**Interfaces:**
- Consumes: nada
- Produces: `AppShell`, `Button`, `Field`, `StatusPill`, `EmptyState`, `Spinner`, `useToast()`

- [ ] **Step 1: Escrever o teste que falha**

```tsx
it('renders a readable label for each status', () => {
  render(<StatusPill status="PROCESSING" />);
  expect(screen.getByText('Processando')).toBeInTheDocument();
});

it('marks the pill as a live region while work is in progress', () => {
  const { rerender } = render(<StatusPill status="PROCESSING" />);
  expect(screen.getByRole('status')).toBeInTheDocument();
  rerender(<StatusPill status="COMPLETED" />);
  expect(screen.queryByRole('status')).toBeNull();
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -w @fiapx/web`
Expected: FAIL.

- [ ] **Step 3: Escrever `tokens.css`**

```css
:root {
  color-scheme: light dark;

  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;

  --text-xs: 0.75rem;   --text-sm: 0.8125rem;  --text-base: 0.9375rem;
  --text-lg: 1.0625rem; --text-xl: 1.375rem;   --text-2xl: 1.75rem;

  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-8: 48px;

  --radius-sm: 4px; --radius-md: 6px; --radius-lg: 10px;

  --bg: #fbfbfa;
  --surface: #ffffff;
  --surface-hover: #f4f4f2;
  --border: #e3e2df;
  --border-strong: #cfcecа;
  --text: #1c1b19;
  --text-muted: #6f6d68;
  --accent: #1f6f4a;
  --accent-hover: #185b3c;
  --accent-soft: #e6f2eb;
  --danger: #a3352b;
  --danger-soft: #fbeae8;
  --warning: #8a6100;
  --warning-soft: #fdf3df;

  --shadow-sm: 0 1px 2px rgb(28 27 25 / 0.06);
  --shadow-md: 0 4px 12px rgb(28 27 25 / 0.08);
}

[data-theme='dark'] {
  --bg: #16161a;
  --surface: #1e1e23;
  --surface-hover: #26262c;
  --border: #313139;
  --border-strong: #43434d;
  --text: #ececf0;
  --text-muted: #9a9aa4;
  --accent: #4fb583;
  --accent-hover: #6cc79a;
  --accent-soft: #14392a;
  --danger: #e0796d;
  --danger-soft: #3a1f1c;
  --warning: #d9a441;
  --warning-soft: #382c12;
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.4);
  --shadow-md: 0 4px 12px rgb(0 0 0 / 0.5);
}
```

Aplicar o tema escuro também por `@media (prefers-color-scheme: dark)` quando não houver `data-theme` explícito.

- [ ] **Step 4: Implementar os componentes base e o `AppShell`**

Layout de duas colunas: barra lateral de 220px com a marca, navegação (Biblioteca, Enviar) e alternador de tema; área de conteúdo com cabeçalho de página e largura máxima de 1120px. Nada centralizado verticalmente, nada de ícone grande decorativo.

- [ ] **Step 5: Rodar os testes**

Run: `npm test -w @fiapx/web`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): add design tokens, base components and application shell"
```

---

### Task 16: `web` — cliente HTTP e autenticação

**Files:**
- Create: `apps/web/src/lib/{api-client.ts,auth-storage.ts,types.ts}`
- Create: `apps/web/src/features/auth/{AuthProvider.tsx,useAuth.ts,LoginPage.tsx}`
- Test: `apps/web/tests/api-client.test.ts`, `tests/LoginPage.test.tsx`

**Interfaces:**
- Consumes: componentes da Task 15
- Produces:
  - `apiClient` com `register`, `login`, `me`, `listVideos`, `getVideo`, `uploadVideo`, `downloadUrl`
  - `AuthProvider`, `useAuth(): { user, token, login, register, logout, status }`

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('sends the bearer token on authenticated calls', async () => {
  fetchMock.mockResolvedValue(jsonResponse({ items: [], total: 0 }));
  await apiClient.listVideos({ token: 't0k3n' });
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer t0k3n');
});

it('surfaces the server error message', async () => {
  fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'E-mail já cadastrado' } }, 400));
  await expect(apiClient.register({ name: 'A', email: 'a@b.c', password: '12345678' }))
    .rejects.toThrow('E-mail já cadastrado');
});

it('logs the user out on 401', async () => {
  fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'Unauthorized' } }, 401));
  const onUnauthorized = jest.fn();
  await expect(apiClient.listVideos({ token: 'x', onUnauthorized })).rejects.toThrow();
  expect(onUnauthorized).toHaveBeenCalled();
});
```

```tsx
it('shows a validation message when the password is too short', async () => {
  render(<LoginPage />);
  await user.click(screen.getByRole('tab', { name: 'Criar conta' }));
  await user.type(screen.getByLabelText('Senha'), '123');
  await user.click(screen.getByRole('button', { name: 'Criar conta' }));
  expect(await screen.findByText('A senha precisa de ao menos 8 caracteres.')).toBeVisible();
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -w @fiapx/web`
Expected: FAIL.

- [ ] **Step 3: Implementar o cliente e o provedor de autenticação**

Token em `localStorage` sob a chave `fiapx.token`. `AuthProvider` restaura a sessão chamando `/me` no primeiro render e limpa o token em `401`.

- [ ] **Step 4: Implementar a `LoginPage`**

Painel único com duas abas (`Entrar` / `Criar conta`), rótulos visíveis, `aria-describedby` para o erro de cada campo e foco no primeiro campo inválido no envio.

- [ ] **Step 5: Rodar os testes**

Run: `npm test -w @fiapx/web`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): add api client and authentication flow"
```

---

### Task 17: `web` — biblioteca com polling adaptativo

**Files:**
- Create: `apps/web/src/features/videos/{useVideos.ts,VideoLibraryPage.tsx,VideoTable.tsx,VideoFilters.tsx}`
- Test: `apps/web/tests/useVideos.test.ts`, `tests/VideoLibraryPage.test.tsx`

**Interfaces:**
- Consumes: `apiClient`, `useAuth`, `StatusPill`, `EmptyState`
- Produces: `useVideos(f: { status?; search? }): { videos, total, isLoading, error, refresh }`; `pollIntervalFor(videos): number`

- [ ] **Step 1: Escrever os testes que falham**

```ts
describe('pollIntervalFor', () => {
  it('polls fast while anything is pending or processing', () => {
    expect(pollIntervalFor([{ status: 'PROCESSING' }, { status: 'COMPLETED' }])).toBe(2000);
    expect(pollIntervalFor([{ status: 'PENDING' }])).toBe(2000);
  });

  it('backs off when everything reached a terminal state', () => {
    expect(pollIntervalFor([{ status: 'COMPLETED' }, { status: 'FAILED' }])).toBe(15000);
  });

  it('backs off on an empty library', () => {
    expect(pollIntervalFor([])).toBe(15000);
  });
});
```

```tsx
it('shows an empty state with a call to action when there is no video', async () => {
  render(<VideoLibraryPage />);
  expect(await screen.findByText('Nenhum vídeo por aqui ainda')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Enviar vídeo' })).toBeVisible();
});

it('only offers download for completed videos', async () => {
  render(<VideoLibraryPage />);
  const rows = await screen.findAllByRole('row');
  expect(within(rows[1]).getByRole('link', { name: /baixar/i })).toBeVisible();
  expect(within(rows[2]).queryByRole('link', { name: /baixar/i })).toBeNull();
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -w @fiapx/web -- useVideos VideoLibraryPage`
Expected: FAIL.

- [ ] **Step 3: Implementar `pollIntervalFor` e `useVideos`**

O polling pausa quando `document.visibilityState === 'hidden'` e retoma imediatamente ao voltar. O intervalo é reavaliado a cada resposta.

- [ ] **Step 4: Implementar a tabela e os filtros**

Tabela real (`<table>`), com colunas Nome, Status, Duração, Frames, Enviado em, Ação. Números com `font-variant-numeric: tabular-nums`. Skeleton no primeiro carregamento; atualizações seguintes não piscam.

- [ ] **Step 5: Rodar os testes**

Run: `npm test -w @fiapx/web`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): add video library with adaptive status polling"
```

---

### Task 18: `web` — upload com progresso real

**Files:**
- Create: `apps/web/src/features/upload/{UploadPage.tsx,Dropzone.tsx,UploadQueue.tsx,useUploadQueue.ts,uploadWithProgress.ts}`
- Test: `apps/web/tests/uploadWithProgress.test.ts`, `tests/Dropzone.test.tsx`

**Interfaces:**
- Consumes: `apiClient`, `useAuth`
- Produces: `uploadWithProgress(i: { file; token; frameIntervalSeconds; onProgress: (p: number) => void; signal?: AbortSignal }): Promise<VideoSummary>`; `useUploadQueue()`

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('reports progress from the xhr upload events', async () => {
  const onProgress = jest.fn();
  const promise = uploadWithProgress({ file, token: 't', frameIntervalSeconds: 20, onProgress });
  xhrMock.upload.onprogress({ lengthComputable: true, loaded: 50, total: 200 });
  xhrMock.upload.onprogress({ lengthComputable: true, loaded: 200, total: 200 });
  xhrMock.onload();
  await promise;
  expect(onProgress).toHaveBeenNthCalledWith(1, 25);
  expect(onProgress).toHaveBeenNthCalledWith(2, 100);
});

it('rejects with the server message on a 4xx response', async () => {
  const promise = uploadWithProgress({ file, token: 't', frameIntervalSeconds: 20, onProgress: jest.fn() });
  xhrMock.status = 413;
  xhrMock.responseText = JSON.stringify({ error: { message: 'Arquivo maior que 500 MB' } });
  xhrMock.onload();
  await expect(promise).rejects.toThrow('Arquivo maior que 500 MB');
});

it('aborts the request when the signal fires', async () => {
  const controller = new AbortController();
  const promise = uploadWithProgress({ file, token: 't', frameIntervalSeconds: 20, onProgress: jest.fn(), signal: controller.signal });
  controller.abort();
  expect(xhrMock.abort).toHaveBeenCalled();
  await expect(promise).rejects.toThrow(/cancel/i);
});
```

```tsx
it('rejects a file with an unsupported extension before uploading', async () => {
  render(<Dropzone onFiles={onFiles} />);
  await user.upload(screen.getByLabelText('Selecionar arquivos'), new File(['x'], 'doc.pdf', { type: 'application/pdf' }));
  expect(await screen.findByText('Formato não suportado: doc.pdf')).toBeVisible();
  expect(onFiles).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -w @fiapx/web -- upload Dropzone`
Expected: FAIL.

- [ ] **Step 3: Implementar `uploadWithProgress` com `XMLHttpRequest`**

`fetch` não expõe progresso de upload — por isso `XMLHttpRequest`.

- [ ] **Step 4: Implementar `Dropzone`, `UploadQueue` e `UploadPage`**

A dropzone é acessível: `<input type="file" multiple>` rotulado, mais os handlers de arrastar e soltar. A fila mostra nome, tamanho, barra de progresso, estado e botão de cancelar. Envia até 3 arquivos em paralelo.

- [ ] **Step 5: Rodar os testes**

Run: `npm test -w @fiapx/web`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): add drag-and-drop upload queue with real progress"
```

---

### Task 19: `web` — detalhe do vídeo, roteamento e imagem

**Files:**
- Create: `apps/web/src/features/videos/{VideoDetailPage.tsx,EventTimeline.tsx}`
- Modify: `apps/web/src/App.tsx` (rotas)
- Create: `apps/web/nginx.conf`, `apps/web/Dockerfile`
- Test: `apps/web/tests/VideoDetailPage.test.tsx`

**Interfaces:**
- Consumes: `apiClient.getVideo`, `apiClient.downloadUrl`, `StatusPill`
- Produces: rotas `/`, `/login`, `/upload`, `/videos/:id`

- [ ] **Step 1: Escrever o teste que falha**

```tsx
it('shows the failure reason when processing failed', async () => {
  render(<VideoDetailPage />, { video: { status: 'FAILED', errorReason: 'ffmpeg exited with code 1' } });
  expect(await screen.findByText('ffmpeg exited with code 1')).toBeVisible();
  expect(screen.queryByRole('link', { name: /baixar/i })).toBeNull();
});

it('lists the event timeline in chronological order', async () => {
  render(<VideoDetailPage />);
  const items = await screen.findAllByRole('listitem');
  expect(items.map((i) => i.textContent)).toEqual([
    expect.stringContaining('Recebido'),
    expect.stringContaining('Processando'),
    expect.stringContaining('Concluído'),
  ]);
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -w @fiapx/web -- VideoDetailPage`
Expected: FAIL.

- [ ] **Step 3: Implementar a página de detalhe e a timeline**

Cabeçalho com nome, status e ação de download; grade de metadados (duração, frames, tamanho do zip, intervalo); timeline dos eventos com hora relativa e absoluta.

- [ ] **Step 4: Ligar as rotas e escrever `nginx.conf` e `Dockerfile`**

O `nginx.conf` faz `try_files $uri /index.html` e envia `/api/` para a `video-api`. O `Dockerfile` compila com `node:22-alpine` e serve com `nginx:1.27-alpine`.

- [ ] **Step 5: Rodar os testes e o build**

Run: `npm test -w @fiapx/web && npm run build -w @fiapx/web`
Expected: PASS e `dist/` gerado.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): add video detail page, routing and nginx image"
```

---

### Task 20: Ambiente local completo com Docker Compose

**Files:**
- Create: `infra/docker-compose.yml`, `infra/db/init.sql`
- Create: `infra/prometheus/prometheus.yml`, `infra/grafana/provisioning/datasources/prometheus.yml`, `infra/grafana/provisioning/dashboards/{dashboards.yml,fiapx.json}`
- Create: `Makefile`
- Test: verificação manual descrita no Step 5

**Interfaces:**
- Consumes: as imagens das Tasks 11, 13, 14 e 19
- Produces: `make up`, `make down`, `make logs`, `make seed`

- [ ] **Step 1: Escrever `infra/db/init.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS citext;
CREATE SCHEMA IF NOT EXISTS video;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fiapx_video') THEN
    CREATE ROLE fiapx_video LOGIN PASSWORD 'fiapx_video_pwd';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE fiapx TO fiapx_video;
GRANT USAGE, CREATE ON SCHEMA video TO fiapx_video;
ALTER DEFAULT PRIVILEGES IN SCHEMA video
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fiapx_video;
```

- [ ] **Step 2: Escrever `infra/docker-compose.yml`**

Serviços: `postgres:17-alpine` (monta `init.sql`), `redis:7-alpine`, `rabbitmq:3.13-management`, `minio` + `minio-init` (cria os buckets), `mailhog`, `video-api`, `video-processor` (`deploy.replicas: 2`), `notification`, `web`, `prometheus`, `grafana`. Todos com `healthcheck` e `depends_on: condition: service_healthy`. Migrações rodam num serviço `migrate` de execução única antes da API.

- [ ] **Step 3: Configurar Prometheus e Grafana**

`prometheus.yml` faz scrape de `video-api:3000/metrics` e `video-processor:9100/metrics`. O dashboard mostra: vídeos por status, taxa de processamento, p95 da duração, profundidade da fila e falhas.

- [ ] **Step 4: Escrever o `Makefile`**

```make
up:      ; docker compose -f infra/docker-compose.yml up -d --build
down:    ; docker compose -f infra/docker-compose.yml down -v
logs:    ; docker compose -f infra/docker-compose.yml logs -f video-api video-processor
ps:      ; docker compose -f infra/docker-compose.yml ps
scale:   ; docker compose -f infra/docker-compose.yml up -d --scale video-processor=4
```

- [ ] **Step 5: Validar o ambiente de ponta a ponta**

Run: `make up` e aguardar todos os serviços ficarem saudáveis.
Verificar: `http://localhost:8080` abre a aplicação; criar conta; subir um `.mp4` curto; o status vai de `PENDING` a `COMPLETED`; o zip baixa e contém os frames; `http://localhost:8025` (MailHog) recebe o e-mail; `http://localhost:3001` (Grafana) mostra o dashboard.

- [ ] **Step 6: Commit**

```bash
git add infra Makefile
git commit -m "feat(infra): add full docker compose environment with observability"
```

---

### Task 21: Manifests Kubernetes

**Files:**
- Create: `infra/k8s/{namespace.yaml,configmap.yaml,secret.example.yaml,postgres.yaml,redis.yaml,rabbitmq.yaml,minio.yaml}`
- Create: `infra/k8s/{video-api-deployment.yaml,video-api-service.yaml,video-api-hpa.yaml}`
- Create: `infra/k8s/{video-processor-deployment.yaml,video-processor-hpa.yaml}`
- Create: `infra/k8s/{notification-deployment.yaml,web-deployment.yaml,web-service.yaml,migration-job.yaml}`

**Interfaces:**
- Consumes: as imagens publicadas pela Task 22
- Produces: `kubectl apply -k infra/k8s` sobe a stack completa

- [ ] **Step 1: Escrever os manifests de base**

Namespace `fiapx`; `ConfigMap` com as variáveis não sensíveis; `secret.example.yaml` documenta as chaves sem valores reais.

- [ ] **Step 2: Escrever o Deployment e o HPA da `video-api`**

2 réplicas, `readinessProbe` em `/health/ready`, `livenessProbe` em `/health`, `resources.requests` `100m`/`256Mi` e `limits` `500m`/`512Mi`, HPA de 2 a 6 réplicas com alvo de 70% de CPU.

- [ ] **Step 3: Escrever o Deployment e o HPA do `video-processor`**

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: video-processor
  namespace: fiapx
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: video-processor
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 65 }
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
```

`terminationGracePeriodSeconds: 120` para que um vídeo em processamento termine antes do pod morrer.

- [ ] **Step 4: Escrever o Job de migração**

`Job` com `backoffLimit: 3` que roda `npm run migration:run` antes do rollout da API.

- [ ] **Step 5: Validar os manifests**

Run: `kubectl apply --dry-run=client -k infra/k8s`
Expected: todos os recursos validados sem erro.

- [ ] **Step 6: Commit**

```bash
git add infra/k8s
git commit -m "feat(infra): add kubernetes manifests with autoscaling for api and processor"
```

---

### Task 22: CI/CD

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/cd.yml`
- Create: `.github/dependabot.yml`, `sonar-project.properties`

**Interfaces:**
- Consumes: os scripts npm das tasks anteriores
- Produces: CI verde em pull request; imagens publicadas no GHCR em `main`

- [ ] **Step 1: Escrever `ci.yml`**

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        workspace:
          - '@fiapx/shared'
          - '@fiapx/video-api'
          - '@fiapx/video-processor'
          - '@fiapx/notification-service'
          - '@fiapx/web'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run build -w @fiapx/shared
      - run: npx eslint . --ext .ts,.tsx
      - run: npm run typecheck -w ${{ matrix.workspace }}
      - run: npm run test:unit -w ${{ matrix.workspace }} -- --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-${{ strategy.job-index }}
          path: '**/coverage/lcov.info'

  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci && npm run build -w @fiapx/shared
      - run: npm run test:integration -w @fiapx/video-api
      - run: npm run test:bdd -w @fiapx/video-api
```

- [ ] **Step 2: Adicionar o job do SonarCloud**

Baixa os artefatos de cobertura e roda `SonarSource/sonarcloud-github-action`. `sonar-project.properties` aponta `sonar.javascript.lcov.reportPaths` para todos os `lcov.info`.

- [ ] **Step 3: Escrever `cd.yml`**

Em push para `main`: `docker/build-push-action` para as quatro imagens, com tags `ghcr.io/<owner>/fiapx-<app>:${{ github.sha }}` e `:latest`, usando cache de camadas do GitHub Actions. O job de deploy no Kubernetes fica em `environment: production` com aprovação manual.

- [ ] **Step 4: Escrever `dependabot.yml`**

Ecossistemas `npm` (raiz, com `versioning-strategy: increase`) e `github-actions`, semanal.

- [ ] **Step 5: Validar**

Run: `npm ci && npm run build -w @fiapx/shared && npx eslint . --ext .ts,.tsx && npm run test:unit`
Expected: PASS — mesmo caminho que o CI executa.

- [ ] **Step 6: Commit**

```bash
git add .github sonar-project.properties
git commit -m "ci: add build, test and image publishing pipelines"
```

---

### Task 23: BDD ponta a ponta e documentação de entrega

**Files:**
- Create: `apps/video-api/features/{video-processing.feature,authentication.feature}`
- Create: `apps/video-api/features/support/{world.ts,hooks.ts,steps.ts}`, `cucumber.js`
- Create: `README.md`, `docs/architecture.md`, `docs/demo-script.md`, `docs/adr/{0001-event-driven-architecture.md,0002-object-storage.md,0003-retry-and-dlq.md}`

**Interfaces:**
- Consumes: a stack completa via Docker Compose
- Produces: `npm run test:bdd -w @fiapx/video-api`

- [ ] **Step 1: Escrever as features**

```gherkin
# language: pt
Funcionalidade: Processamento de vídeos
  Cenário: Usuário envia um vídeo e recebe o zip com os frames
    Dado que existe um usuário autenticado
    Quando ele envia o vídeo "sample.mp4"
    Então o vídeo aparece com status "PENDING"
    E em até 60 segundos o status muda para "COMPLETED"
    E o download retorna um arquivo zip com pelo menos 1 frame

  Cenário: Vídeo corrompido falha e notifica o usuário
    Dado que existe um usuário autenticado
    Quando ele envia o vídeo "corrupted.mp4"
    Então em até 60 segundos o status muda para "FAILED"
    E o motivo da falha é exibido
    E um e-mail de falha é entregue ao usuário

  Cenário: Usuário não enxerga vídeo de outro usuário
    Dado que existem dois usuários autenticados
    E que o primeiro enviou um vídeo
    Quando o segundo consulta o vídeo do primeiro
    Então a resposta é 404
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm run test:bdd -w @fiapx/video-api`
Expected: FAIL — passos indefinidos.

- [ ] **Step 3: Implementar os steps**

`hooks.ts` sobe a stack via Compose (ou reaproveita uma já em execução, quando `BDD_BASE_URL` está definida) e limpa os dados entre cenários. A verificação de e-mail consulta a API do MailHog em `http://localhost:8025/api/v2/messages`. Fixtures `sample.mp4` (5 s, gerado por `ffmpeg -f lavfi -i testsrc`) e `corrupted.mp4` (bytes aleatórios com extensão `.mp4`) ficam em `apps/video-api/features/fixtures/`.

- [ ] **Step 4: Escrever o `README.md`**

Seções: o que é, arquitetura em uma imagem, como rodar (`make up`), variáveis de ambiente, como rodar os testes, endpoints, estrutura de pastas, decisões de arquitetura.

- [ ] **Step 5: Escrever `docs/architecture.md` e os ADRs**

Diagramas em Mermaid: contexto, containers e sequência do processamento (upload → evento → worker → resultado → status → e-mail). Um ADR por decisão relevante, no formato Contexto / Decisão / Consequências.

- [ ] **Step 6: Escrever `docs/demo-script.md`**

Roteiro de 10 minutos, minutado: 0–1 problema; 1–3 arquitetura; 3–5 código e Clean Architecture; 5–8 demonstração (login, upload de três vídeos simultâneos, status ao vivo, download, falha e e-mail); 8–9 escala e resiliência (`docker compose up --scale video-processor=4`, mata um worker durante o processamento e mostra o retry); 9–10 testes e CI/CD.

- [ ] **Step 7: Rodar a suíte completa**

Run: `make up && npm run test:bdd -w @fiapx/video-api && npm test`
Expected: PASS em todos os cenários e suítes.

- [ ] **Step 8: Commit**

```bash
git add apps/video-api/features README.md docs
git commit -m "test: add end-to-end bdd scenarios and delivery documentation"
```

---

## Ordem de execução e paralelismo

Sequencial obrigatório: 1 → 2 → 3 → 4 (fundação compartilhada).
Depois: 5 → 6 → 7 → 8 → 9 → 10 → 11 (`video-api`).
Paralelizáveis após a Task 4: 12–13 (`video-processor`) e 14 (`notification`).
Paralelizáveis após a Task 11: 15 → 16 → 17 → 18 → 19 (`web`).
Fechamento sequencial: 20 → 21 → 22 → 23.
