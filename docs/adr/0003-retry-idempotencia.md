# ADR 0003 — Retry com backoff, dead letter e idempotência

**Data:** 2026-09-01
**Status:** aceito

## Contexto

O requisito é explícito: em caso de pico, o sistema não pode perder uma requisição. Isso vale
também para falhas transitórias — o storage indisponível por dez segundos, o worker morto no meio
de um vídeo, o broker reiniciando.

RabbitMQ entrega at-least-once. Uma mensagem redelivered depois de um crash faria o worker gerar um
segundo zip e o notificador mandar um segundo e-mail.

Um `nack` com requeue imediato transforma uma falha persistente em laço infinito, consumindo CPU e
impedindo o processamento de mensagens saudáveis.

## Decisão

Três mecanismos combinados.

**Durabilidade.** Exchange e filas `durable`, mensagens `persistent`, publisher confirms
habilitados. O upload só é aceito depois que o broker confirmou o evento; se a confirmação falhar,
o vídeo é marcado como `FAILED` na hora, em vez de ficar `PENDING` para sempre.

**Retry com backoff no broker.** Uma mensagem que falha é republicada no exchange de retry com a
routing key `<delay>.<original>`. Ela cai numa fila cujo `x-message-ttl` é esse delay e cujo
`x-dead-letter-exchange` aponta de volta para o exchange principal. Quando o TTL expira, o broker
devolve a mensagem ao consumidor original. São três tentativas — 30s, 2min, 10min — e depois a
dead letter queue.

**Idempotência.** Todo consumidor grava o `eventId` no Redis com `SET NX EX 86400` antes de agir.
Se a chave já existe, o evento já foi processado e o consumidor apenas dá `ack`.

## Consequências

**A favor**

- O atraso do retry vive no broker, não em `setTimeout`: não ocupa worker, não consome memória do
  processo e sobrevive a um restart.
- Uma falha transitória se resolve sozinha; uma permanente para na DLQ, visível e reprocessável.
- Redelivery não gera zip duplicado nem segundo e-mail.
- A máquina de estados do vídeo rejeita transições fora de ordem, como segunda linha de defesa.

**Contra**

- Redis vira dependência do caminho crítico dos consumidores. Uma falha do Redis faz o evento ser
  retentado em vez de processado — escolha deliberada: repetir é mais seguro do que pular.
- A janela de idempotência é de 24 horas. Uma redelivery depois disso reprocessaria o vídeo. Dado
  que o retry máximo é de 10 minutos, a margem é ampla.
- Mais filas para observar. O dashboard e a documentação de operação cobrem a DLQ.
