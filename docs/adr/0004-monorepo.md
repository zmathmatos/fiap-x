# ADR 0004 — Monorepo com npm workspaces

**Data:** 2026-09-01
**Status:** aceito

## Contexto

Na Fase 4 cada serviço vivia no próprio repositório. Aqui são três serviços, um frontend e um
pacote compartilhado, entregues juntos e avaliados juntos.

O contrato de eventos é o acoplamento central do sistema: se `video-processor` e `video-api`
discordam sobre o formato de `video.processed`, nada funciona.

## Decisão

Um repositório com npm workspaces: `apps/*` para os serviços e o frontend, `packages/shared` para o
que é comum.

`packages/shared` guarda os tipos de evento, o cliente RabbitMQ, o storage S3, a idempotência e o
logger. Nenhum `app` importa outro `app`.

## Consequências

**A favor**

- Uma mudança no contrato de evento quebra a compilação de todos os serviços afetados no mesmo
  commit, em vez de virar erro em produção.
- `make up` sobe o sistema inteiro; um `git clone` basta para avaliar a entrega.
- CI único com matriz por workspace: cada serviço ainda é testado isoladamente.

**Contra**

- Os serviços são versionados juntos. Para uma equipe grande com ciclos independentes isso seria um
  problema; para esta entrega é uma vantagem.
- As imagens Docker precisam do contexto na raiz do repositório, o que deixa os Dockerfiles um
  pouco mais verbosos. Mitigado com `.dockerignore` e cópia dos manifests antes do código, para
  preservar o cache de dependências.
