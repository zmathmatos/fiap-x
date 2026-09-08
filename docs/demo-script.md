# Roteiro da apresentação — 10 minutos

## Antes de gravar

```bash
make down            # começa limpo
make up              # aguarde todos os containers ficarem healthy (make ps)
```

Abra as abas na ordem: aplicação (8080), MailHog (8025), Grafana (3001), RabbitMQ (15672).
Tenha à mão três vídeos curtos (30–60s) e um arquivo inválido — renomeie qualquer `.pdf` para
`.mp4` para simular corrupção.

---

## 0:00–1:00 · O problema

Mostre o projeto base rodando ou uma captura dele.

> "A versão apresentada aos investidores processa um vídeo por vez, dentro da requisição HTTP. Sem
> login, sem persistência, sem fila. Se dois usuários enviarem ao mesmo tempo, um espera. Se o
> processo cair no meio, o vídeo se perde. Foi isso que reconstruímos."

## 1:00–3:00 · Arquitetura

Abra `docs/architecture.md` no diagrama de containers.

Pontos a dizer, nesta ordem:

1. Três serviços com responsabilidade única, comunicando por eventos no RabbitMQ. Saga coreografada,
   sem orquestrador — mesmo padrão da Fase 4.
2. A `video-api` é a única dona do banco. O worker é **sem estado**: é isso que permite escalar para
   N réplicas sem coordenação nenhuma.
3. Mostre o diagrama de retry: o atraso vive no broker via TTL, não em `setTimeout` na aplicação.
   Três tentativas e depois dead letter queue.
4. Uma frase sobre Clean Architecture: `domain` não importa nada de `infrastructure`, e é por isso
   que trocar MinIO por S3 é mudança de variável de ambiente.

## 3:00–4:30 · Código

Abra dois arquivos, não mais:

- `apps/video-api/src/application/use-cases/upload-video.ts` — o upload em stream, a publicação com
  confirm e o trecho que marca o vídeo como `FAILED` se o broker não confirmar. Diga por que isso
  existe: um vídeo nunca pode ficar `PENDING` para sempre.
- `packages/shared/src/messaging/topology.ts` — a escada de retry declarada como topologia.

Mencione: 153 testes unitários, cobertura mínima de 80%, integração com Testcontainers e cenários
BDD em Gherkin.

## 4:30–8:00 · A aplicação funcionando

1. **Criar conta** na tela inicial. Aponte que a senha tem hash bcrypt e a sessão é um JWT.
2. **Enviar três vídeos de uma vez.** Mostre as três barras de progresso subindo em paralelo —
   progresso real de upload, vindo do `XMLHttpRequest`, não animação.
3. **Ir para a biblioteca.** Os status mudam sozinhos de `Na fila` para `Processando` e
   `Concluído`. Diga: polling adaptativo, 2 segundos enquanto há trabalho, 15 quando não há.
4. **Abrir um vídeo concluído.** Mostre a linha do tempo dos eventos, a duração, a contagem de
   frames. **Baixe o zip e abra** — mostre os frames dentro.
5. **Enviar o arquivo corrompido.** O status vai para `Falhou` com o motivo. Vá ao MailHog e mostre
   o e-mail que chegou.

## 8:00–9:00 · Escala e resiliência

```bash
make scale     # sobe para 4 workers
```

- No RabbitMQ (15672), mostre a fila `video-processor.uploads` com quatro consumidores.
- Envie mais vídeos e mostre a fila drenando mais rápido.
- **Mate um worker no meio de um processamento:**

```bash
docker kill $(docker ps -q -f name=video-processor | head -1)
```

Mostre que o vídeo **não se perde**: a mensagem não foi acked, volta para a fila e outro worker
pega. Esse é o requisito de "não perder requisição em pico" demonstrado ao vivo.

- No Grafana, mostre o dashboard: vazão, p95 de processamento, workers ativos.

## 9:00–10:00 · Qualidade e entrega

- Abra o GitHub Actions: matriz por workspace, lint, typecheck, unitários, integração, BDD, build
  das quatro imagens, SonarCloud.
- Mostre `infra/k8s/video-processor.yaml`: HPA de 2 a 10 réplicas e
  `terminationGracePeriodSeconds: 120` — o pod termina o vídeo que está processando antes de morrer.
- Feche com os entregáveis: documentação de arquitetura, ADRs, script do banco, compose,
  manifests k8s e CI/CD.

---

## Se algo der errado

| Sintoma                       | O que fazer                                                             |
| ----------------------------- | ----------------------------------------------------------------------- |
| Container não fica healthy    | `make ps` e `docker compose -f infra/docker-compose.yml logs <serviço>` |
| Vídeo travado em `PENDING`    | Verifique o RabbitMQ em 15672: há consumidor na fila?                   |
| Vídeo travado em `PROCESSING` | `make logs` — procure o erro do ffmpeg                                  |
| Upload devolve 401            | O token expirou (8h). Saia e entre de novo                              |
| Porta ocupada                 | `make down`, depois `make up`                                           |
