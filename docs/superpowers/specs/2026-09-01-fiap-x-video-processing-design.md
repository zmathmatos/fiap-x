# FIAP X — Sistema de Processamento de Vídeos

**Data:** 2026-09-01
**Status:** aprovado
**Contexto:** Hackathon POSTECH SOAT — Fase 5

## 1. Problema

A FIAP X possui um protótipo que recebe um vídeo, extrai frames e devolve um `.zip`. O protótipo é
monolítico, síncrono, sem autenticação, sem persistência e sem tolerância a falha. Os investidores
querem uma versão em que o usuário faça upload de vídeos e baixe o `.zip` de frames.

A nova versão precisa:

- processar múltiplos vídeos simultaneamente;
- não perder requisições em pico de carga;
- exigir usuário e senha;
- listar o status dos vídeos de cada usuário;
- notificar o usuário em caso de erro;
- persistir dados, escalar horizontalmente, ter testes e CI/CD.

## 2. Decisões de arquitetura

| Decisão | Escolha | Motivo |
|---|---|---|
| Estilo | Microsserviços event-driven | Isola o trabalho de CPU (ffmpeg) da API de baixa latência |
| Camadas | Clean Architecture | Mesmo padrão dos serviços da Fase 4 do grupo |
| Runtime | Node.js 22 + TypeScript 5 + Express 5 | Igual `fiap-soat-execution-service` |
| Mensageria | RabbitMQ, topic exchange, eventos coreografados | Igual Fase 4; sem orquestrador central |
| Banco | PostgreSQL 17 + TypeORM | Igual `execution-service` (schema isolado por serviço) |
| Cache/idempotência | Redis 7 | Dedupe de eventos e cache de listagem |
| Object storage | MinIO (API S3) | Roda local; troca para S3 apenas por variável de ambiente |
| E-mail | Nodemailer + MailHog (local) | Igual `billing-service` |
| Frontend | React 18 + Vite + TypeScript, CSS próprio | Sem biblioteca de componentes com visual genérico |
| Empacotamento | Docker multi-stage + Docker Compose; manifests k8s + HPA | Demo confiável e prova de escalabilidade |
| CI/CD | GitHub Actions com matrix por app + SonarCloud | Igual Fase 4 |
| Repositório | Monorepo com npm workspaces | Uma entrega, um `docker compose up` |

### Alternativas descartadas

- **Upload via presigned URL** (browser envia direto ao storage): reduz carga da API, mas exige
  CORS no bucket, confirmação de upload em duas fases e complica o frontend. Descartado por prazo.
- **Notificação embutida no processor**: acopla envio de e-mail ao worker de CPU e faz uma falha de
  SMTP derrubar o processamento. Descartado.
- **auth-service separado**: adiciona um hop de rede e mais superfície de falha na demo sem ganho
  arquitetural relevante nesta escala. A autenticação vive na `video-api`.

## 3. Visão geral

```
[web React/Vite]
      | HTTPS (JWT)
      v
[video-api :3000] ---> PostgreSQL (schema video)
      |             --> Redis (idempotência + cache)
      |             --> MinIO (bucket raw/)
      | publish video.uploaded
      v
=== RabbitMQ · topic exchange "video-events" (durable) ===
      |                                          |
      v                                          v
[video-processor x N]                   [notification-service]
 ffmpeg -> frames -> zip -> MinIO         video.failed/processed -> e-mail
 publish video.processing.started
         video.processed | video.failed
      |
      +--> video.retry (TTL + backoff, 3x) --> video.dlq
```

`video-api` é a única dona do PostgreSQL. `video-processor` é **stateless**: consome, processa,
publica. Isso permite escalar réplicas sem coordenação.

## 4. Serviços

### 4.1 `video-api`

Responsabilidades: autenticação, ingestão de upload, consulta de status, download do zip, e
atualização do status a partir dos eventos do processor.

**Endpoints**

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/register` | Cria usuário (e-mail + senha) |
| POST | `/auth/login` | Devolve JWT |
| GET | `/me` | Dados do usuário autenticado |
| POST | `/videos` | Upload multipart; responde `202 {id, status:"PENDING"}` |
| GET | `/videos` | Lista paginada do usuário; filtro `status`, `page`, `limit` |
| GET | `/videos/:id` | Detalhe, incluindo histórico de eventos |
| GET | `/videos/:id/download` | Stream do `.zip` |
| GET | `/health` | Liveness |
| GET | `/health/ready` | Readiness (Postgres, RabbitMQ, MinIO) |
| GET | `/metrics` | Métricas Prometheus |

**Regras**

- Senha com hash `bcrypt` (custo 12). JWT HS256, expiração 8h, segredo em variável de ambiente.
- Todo acesso a vídeo é escopado por `userId`. Vídeo de outro usuário responde `404`, nunca `403`,
  para não vazar existência do recurso.
- Upload é feito em stream direto para o MinIO (`busboy`), sem carregar o arquivo em memória.
- Formatos aceitos: `mp4`, `mov`, `avi`, `mkv`, `webm`. Limite padrão 500 MB (`MAX_UPLOAD_BYTES`).
- Resposta é `202 Accepted`: a API nunca processa vídeo de forma síncrona.

### 4.2 `video-processor`

Worker sem estado. Ciclo:

1. Consome `video.uploaded` com `prefetch=1`.
2. Publica `video.processing.started`.
3. Baixa o objeto do MinIO para diretório temporário.
4. `ffprobe` obtém duração e metadados.
5. `ffmpeg -vf fps=1/N` extrai frames em JPEG.
6. `archiver` compacta os frames em stream e envia para `zips/`.
7. Publica `video.processed` com `zipKey`, `frameCount`, `durationMs`, `sizeBytes`.
8. `ack` manual. Remove o diretório temporário em `finally`.

Falha publica `video.failed` com `reason` e devolve a mensagem para a fila de retry.
Intervalo entre frames: `FRAME_INTERVAL_SECONDS` (padrão 20), sobrescrevível por upload.

### 4.3 `notification-service`

Consome `video.failed` e `video.processed`. Envia e-mail via Nodemailer (MailHog em
desenvolvimento, SMTP real por variável de ambiente). Templates em texto e HTML simples.
Falha de SMTP entra em retry e depois na DLQ — nunca afeta o processamento do vídeo.

### 4.4 `web`

React 18 + Vite + TypeScript, sem framework de UI. Telas:

- **Login / Registro** — formulário único com alternância de modo.
- **Biblioteca** — tabela densa com miniatura, nome, duração, status, data e ação de download.
  Filtro por status e busca por nome.
- **Upload** — dropzone com fila; barra de progresso real via eventos `XMLHttpRequest.upload`.
- **Detalhe** — timeline de eventos do vídeo, grade de frames e botão de download.

Atualização de status por polling adaptativo: 2s enquanto houver algum vídeo em `PENDING` ou
`PROCESSING`; 15s caso contrário; pausado quando a aba está oculta.

**Diretrizes visuais.** Design system próprio em `src/styles/tokens.css`: escala tipográfica,
espaçamento em grade de 4px, tema claro e escuro por `prefers-color-scheme` e alternância manual,
uma cor de destaque, bordas de 1px, sombras discretas, números tabulares em métricas. Proibidos:
gradiente roxo-azul, emoji decorativo, card único centralizado com ícone grande, texto de marketing.
Todo estado vazio, de carregamento e de erro é desenhado explicitamente.

## 5. Contratos de evento

Publicados no exchange `video-events` (tipo `topic`, `durable`). Envelope comum, em
`packages/shared/src/events`:

```ts
interface EventEnvelope<T> {
  eventId: string;      // uuid v4 — chave de idempotência
  eventType: string;    // ex.: "video.uploaded"
  occurredAt: string;   // ISO 8601
  correlationId: string;
  payload: T;
}
```

| Routing key | Publisher | Consumidores | Payload |
|---|---|---|---|
| `video.uploaded` | video-api | video-processor | `videoId, userId, storageKey, originalName, frameIntervalSeconds` |
| `video.processing.started` | video-processor | video-api | `videoId` |
| `video.processed` | video-processor | video-api, notification | `videoId, zipKey, frameCount, durationMs, sizeBytes` |
| `video.failed` | video-processor | video-api, notification | `videoId, reason, attempt` |

Máquina de estados: `PENDING → PROCESSING → COMPLETED | FAILED`. Transições inválidas são
ignoradas e registradas em log — protege contra eventos fora de ordem.

## 6. Confiabilidade

- Exchange e filas `durable`; mensagens `persistent`; **publisher confirms** habilitados.
- `prefetch=1` e `ack` manual somente após o zip estar no storage.
- Retry com backoff: `video.retry` com `x-message-ttl` e `x-dead-letter-exchange` apontando de volta
  para a fila de trabalho. Três tentativas (30s, 2min, 10min) e então `video.dlq`.
- Idempotência: cada consumidor grava `eventId` no Redis com `SET NX EX 86400`. Chave existente
  significa evento já processado — `ack` sem efeito colateral.
- Reconexão automática ao RabbitMQ com backoff exponencial.
- Desligamento gracioso: `SIGTERM` para de consumir, aguarda a mensagem em andamento e fecha as
  conexões.
- Escala: HPA de 2 a 10 réplicas do processor por CPU. A documentação descreve também escala por
  profundidade de fila via KEDA como evolução.

## 7. Dados

Schema `video` no PostgreSQL, migrações TypeORM.

```
users        id uuid pk · email citext unique · password_hash · name · created_at
videos       id uuid pk · user_id fk · original_name · storage_key · zip_key
             · status enum · frame_count int · duration_ms int · size_bytes bigint
             · frame_interval_seconds int · error_reason text
             · created_at · updated_at
video_events id uuid pk · video_id fk · type · payload jsonb · created_at
```

Índices: `videos(user_id, created_at desc)`, `videos(status)`, `video_events(video_id)`.

Buckets no MinIO: `fiapx-raw` (originais) e `fiapx-zips` (resultados), ambos privados.

## 8. Observabilidade

- Logs JSON com Pino, incluindo `correlationId` propagado pelo envelope do evento.
- `prom-client` em cada serviço, exposto em `/metrics`. Métricas próprias: `videos_uploaded_total`,
  `videos_processed_total`, `video_processing_duration_seconds` (histograma),
  `video_processing_failures_total`, além das métricas padrão de processo.
- Prometheus e Grafana no Compose, com datasource e dashboard provisionados.
- Healthchecks distintos para liveness e readiness, usados também pelo Kubernetes.

## 9. Testes

| Camada | Ferramenta | Alvo |
|---|---|---|
| Unitário | Jest | Entidades, casos de uso, máquina de estados, política de retry |
| Integração | Jest + Testcontainers | Repositórios (Postgres), publisher/consumer (RabbitMQ), storage (MinIO) |
| BDD | Cucumber | `upload → processamento → download`, autenticação, isolamento entre usuários |
| Frontend | Vitest + Testing Library | Componentes, hooks de polling, fluxo de upload |

Cobertura mínima de 80% por serviço, verificada no CI. Testes de integração e BDD exigem Docker.

## 10. CI/CD

- **CI** (pull request): matrix por app — `lint → typecheck → test:unit → test:integration →
  test:bdd → build` e análise SonarCloud.
- **CD** (push em `main`): build das imagens multi-stage e push para o GHCR com tags `sha` e
  `latest`; passo de deploy em Kubernetes documentado e desabilitado por padrão.
- Dependabot para dependências npm e ações do GitHub.

## 11. Entregáveis

1. Monorepo no GitHub com os três serviços, o frontend e o pacote compartilhado.
2. `docs/architecture.md` com diagramas (contexto, containers e sequência de processamento) e ADRs.
3. `infra/db/init.sql` com criação de schema, roles e permissões, além das migrações TypeORM.
4. `infra/docker-compose.yml` que sobe o ambiente completo com um comando.
5. `infra/k8s/` com Deployment, Service, ConfigMap, Secret, Job de migração e HPA.
6. Roteiro de demonstração de até 10 minutos em `docs/demo-script.md`.

## 12. Pré-requisitos do ambiente

- Node.js 22 ou superior. **A máquina atual usa Node 14.21.3 por padrão; a versão 24.19.0 já está
  instalada no nvm e precisa ser ativada com `nvm use 24.19.0`.**
- **Docker Desktop não está instalado nesta máquina.** É obrigatório para subir o ambiente, rodar
  testes de integração e BDD, e gravar a demonstração. Sem Docker, apenas os testes unitários e o
  build do frontend são executáveis localmente.
- `ffmpeg` é fornecido pela imagem do `video-processor`; não precisa estar instalado no host.

## 13. Fora de escopo

- Streaming ou player de vídeo no navegador.
- Cobrança, planos ou limites por usuário.
- Recuperação de senha e verificação de e-mail.
- Provisionamento AWS com Terraform (o design permanece compatível: MinIO troca por S3, e os
  manifests aplicam-se ao EKS sem alteração).
