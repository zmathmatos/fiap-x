# FIAP X — Processamento de Vídeos

Plataforma que recebe vídeos, extrai frames de forma assíncrona e devolve um `.zip`.
Hackathon POSTECH SOAT — Fase 5.

O protótipo apresentado aos investidores processava um vídeo por vez, de forma síncrona, sem
autenticação e sem persistência. Esta versão processa vários vídeos em paralelo, não perde
requisições em pico, exige login, mostra o status de cada arquivo e avisa o usuário por e-mail
quando algo falha.

---

## Como rodar

**Pré-requisitos:** Docker + Docker Compose. Para desenvolver fora dos containers, Node.js 22+.

```bash
cp env.example .env      # opcional: o compose já traz valores de desenvolvimento
make up                  # sobe tudo (o primeiro build leva alguns minutos)
```

| Serviço                   | Endereço               | Acesso                         |
| ------------------------- | ---------------------- | ------------------------------ |
| Aplicação                 | http://localhost:8080  | crie uma conta na tela inicial |
| API                       | http://localhost:3000  | —                              |
| Caixa de e-mail (MailHog) | http://localhost:8025  | —                              |
| RabbitMQ                  | http://localhost:15672 | `fiapx` / `fiapx`              |
| Storage (S3Mock)          | http://localhost:9000  | sem autenticação (só dev/teste)|
| Grafana                   | http://localhost:3001  | acesso anônimo liberado        |
| Prometheus                | http://localhost:9090  | —                              |

Outros comandos:

```bash
make logs     # logs da API e dos workers
make scale    # sobe para 4 workers
make ps       # estado dos containers
make down     # derruba tudo e apaga os volumes
```

---

## Arquitetura

```
[web React/Vite] ──HTTPS(JWT)──► [video-api] ──► PostgreSQL (schema video)
                                     │      ──► Redis (idempotência)
                                     │      ──► S3Mock (bucket raw)
                                     │ publica video.uploaded
                                     ▼
              ╔═ RabbitMQ · topic exchange "video-events" (durable) ═╗
                     │                                    │
                     ▼                                    ▼
          [video-processor × N]                  [notification-service]
          ffmpeg → frames → zip → S3Mock          e-mail de falha/sucesso
          publica processing.started,
                  processed | failed
                     │
                     └─► retry (30s → 2min → 10min) ─► dead letter queue
```

- **`video-api`** — autenticação, ingestão do upload, consulta de status, download do zip. É a
  única dona do banco: também consome os eventos do worker para atualizar o status.
- **`video-processor`** — worker sem estado. Consome, roda ffmpeg, compacta, publica o resultado.
  Escala horizontalmente sem coordenação.
- **`notification-service`** — consome os eventos de resultado e envia e-mail. Não acessa banco:
  tudo que precisa viaja no evento.
- **`web`** — React 18 + Vite, servido por nginx.
- **`packages/shared`** — envelope de eventos, cliente RabbitMQ, storage S3, idempotência, logger.

Detalhes e diagramas em [`docs/architecture.md`](docs/architecture.md). As decisões estão
registradas em [`docs/adr/`](docs/adr).

### Por que não perde requisição em pico

| Mecanismo                                          | Efeito                                                      |
| -------------------------------------------------- | ----------------------------------------------------------- |
| Exchange e filas `durable`, mensagens persistentes | Sobrevivem ao restart do broker                             |
| Publisher confirms                                 | O upload só é aceito depois que o broker confirmou o evento |
| `prefetch=1` e ack manual após o zip subir         | Um worker que morre no meio devolve a mensagem              |
| Retry com backoff (30s, 2min, 10min) e DLQ         | Falha transitória não vira falha definitiva                 |
| Idempotência por `eventId` no Redis                | Redelivery não gera zip nem e-mail duplicado                |
| HPA de 2 a 10 réplicas do worker                   | A fila drena mais rápido conforme a carga sobe              |

---

## API

| Método | Rota                                     | Descrição                                            |
| ------ | ---------------------------------------- | ---------------------------------------------------- |
| POST   | `/auth/register`                         | Cria conta e devolve JWT                             |
| POST   | `/auth/login`                            | Autentica e devolve JWT                              |
| GET    | `/me`                                    | Usuário da sessão                                    |
| POST   | `/videos`                                | Upload `multipart/form-data`; responde `202`         |
| GET    | `/videos`                                | Lista paginada (`status`, `search`, `page`, `limit`) |
| GET    | `/videos/:id`                            | Detalhe com linha do tempo dos eventos               |
| GET    | `/videos/:id/download`                   | Stream do `.zip`                                     |
| GET    | `/health` · `/health/ready` · `/metrics` | Liveness, readiness e métricas Prometheus            |

Todas as rotas de vídeo são escopadas pelo usuário do token. Um vídeo de outra conta responde
`404`, nunca `403` — assim a resposta não confirma que o id existe.

Coleção Postman com todas as rotas (Video API, video-processor e notification-service) em
[`docs/postman/`](docs/postman/README.md).

Exemplo:

```bash
TOKEN=$(curl -s localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ana","email":"ana@fiapx.local","password":"senha-secreta"}' | jq -r .token)

curl -s localhost:3000/videos -H "Authorization: Bearer $TOKEN" \
  -F frameIntervalSeconds=5 -F file=@meu-video.mp4
```

---

## Testes

```bash
npm run test:unit                          # todos os workspaces
npm run test:integration -w @fiapx/video-api   # Testcontainers (precisa de Docker)
npm run test:bdd -w @fiapx/video-api           # Cucumber contra o ambiente do compose
```

| Workspace                     | Testes | Cobre                                                                                                 |
| ----------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| `@fiapx/shared`               | 28     | envelope, topologia de retry, política do consumidor, idempotência, progresso no Redis                |
| `@fiapx/video-api`            | 89     | domínio, casos de uso, middleware, rotas, mapeamento de persistência, metadados do vídeo              |
| `@fiapx/video-processor`      | 30     | argumentos do ffmpeg e do ffprobe, leitura de progresso, ciclo de processamento, limpeza do workspace |
| `@fiapx/notification-service` | 14     | templates, escape de HTML, idempotência do envio                                                      |
| `@fiapx/web`                  | 38     | formatação, cliente HTTP, polling adaptativo, paginação, dropzone                                     |

Cobertura mínima de 80% por workspace, verificada no CI.

---

## Estrutura

```
apps/
  video-api/              API REST + consumidor de eventos de resultado
  video-processor/        worker ffmpeg
  notification-service/   e-mails
  web/                    frontend React
packages/
  shared/                 contratos de evento, mensageria, storage, logger
infra/
  docker-compose.yml      ambiente local completo
  db/init.sql             schema, role e extensões
  k8s/                    Deployments, Services, HPA, Job de migração
  prometheus/ grafana/    observabilidade provisionada
docs/                     arquitetura, ADRs, roteiro da demo
```

Cada serviço segue Clean Architecture: `domain` (entidades e portas), `application` (casos de uso),
`infrastructure` (adaptadores) e `interface` (HTTP). O domínio não importa nada de fora.

---

## Configuração

Todas as variáveis estão documentadas em [`env.example`](env.example). As que mais importam:

| Variável                 | Padrão      | Para que serve                                                       |
| ------------------------ | ----------- | -------------------------------------------------------------------- |
| `JWT_SECRET`             | —           | Obrigatória. Assina os tokens                                        |
| `MAX_UPLOAD_BYTES`       | `524288000` | Limite por arquivo (500 MB)                                          |
| `FRAME_INTERVAL_SECONDS` | `20`        | Intervalo padrão entre frames; o usuário pode sobrescrever no upload |
| `STORAGE_ENDPOINT`       | S3Mock local | Aponte para o S3 em produção e nada mais muda                       |
| `PROCESSOR_PREFETCH`     | `1`         | Um vídeo por réplica: ffmpeg já satura a CPU disponível              |

> No Compose local a API conecta ao Postgres com o usuário `fiapx` (dono do banco) para simplificar
> a demonstração. O `init.sql` também cria o role `fiapx_video`, restrito ao schema `video` — é ele
> que o `Secret` do Kubernetes usa.

---

## CI/CD

- **CI** em cada PR: lint, typecheck, testes unitários com cobertura, testes de integração,
  cenários BDD, build das quatro imagens e análise SonarCloud. Matriz por workspace.
- **CD** em `main`: publica as imagens no GHCR com as tags `sha` e `latest`. O deploy em Kubernetes
  fica atrás do environment `production` e só roda com a variável `DEPLOY_ENABLED`.

---

## Kubernetes

```bash
kubectl -n fiapx create secret generic fiapx-secrets --from-literal=JWT_SECRET=... # ver secret.example.yaml
kubectl apply -k infra/k8s
```

O `video-processor` escala de 2 a 10 réplicas por CPU, com `terminationGracePeriodSeconds: 120`
para que um vídeo em processamento termine antes de o pod morrer.
