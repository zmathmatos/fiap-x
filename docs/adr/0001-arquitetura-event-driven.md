# ADR 0001 — Processamento assíncrono orientado a eventos

**Data:** 2026-09-01
**Status:** aceito

## Contexto

O protótipo processava o vídeo dentro da requisição HTTP. Isso amarra o tempo de resposta ao
tamanho do arquivo, derruba o upload se o processo reiniciar, e faz um pico de tráfego virar
timeout — exatamente os problemas que o hackathon pede para resolver.

Extrair frames é trabalho de CPU medido em minutos. Responder HTTP é trabalho de milissegundos.
Colocar os dois no mesmo processo faz com que o mais lento defina o comportamento do mais rápido.

## Decisão

Separar ingestão de processamento por uma fila.

A `video-api` aceita o upload, grava o arquivo no object storage, publica `video.uploaded` e
responde `202 Accepted`. Um worker independente consome o evento e faz o trabalho pesado. O
resultado volta como evento, e a API atualiza o status.

Os serviços se coordenam por eventos, sem orquestrador central — o mesmo padrão de saga
coreografada já adotado nos serviços da Fase 4.

## Consequências

**A favor**

- A API responde em milissegundos, independentemente do tamanho do vídeo.
- Um pico vira fila, não erro. As mensagens esperam no broker.
- O worker escala sozinho: mais réplicas, mais vazão, sem mudar nada na API.
- Uma falha no ffmpeg não afeta quem está navegando na aplicação.

**Contra**

- O usuário não recebe o resultado na mesma resposta. A interface precisa mostrar progresso, o que
  motivou o polling adaptativo e a tela de detalhe com linha do tempo.
- Consistência é eventual: existe um intervalo entre o zip existir no storage e o status dizer
  `COMPLETED`. Aceitável para este domínio.
- Entrega é at-least-once, então todo consumidor precisa ser idempotente — resolvido no ADR 0003.
