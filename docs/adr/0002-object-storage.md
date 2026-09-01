# ADR 0002 — Vídeos e zips em object storage

**Data:** 2026-09-01
**Status:** aceito

## Contexto

Os arquivos precisam existir em algum lugar que a API e qualquer réplica do worker enxerguem. As
opções eram disco local compartilhado, banco de dados ou object storage.

Um vídeo de 500 MB não cabe confortavelmente em nenhuma coluna, e um volume compartilhado entre
pods vira ponto único de falha e de contenção.

## Decisão

Usar object storage compatível com S3: MinIO em desenvolvimento, S3 em produção. Dois buckets
privados: `fiapx-raw` para os originais e `fiapx-zips` para os resultados.

O upload é feito em stream, do corpo da requisição direto para o storage, com `busboy` no parsing e
`@aws-sdk/lib-storage` no envio multipart. O arquivo nunca é carregado em memória nem escrito no
disco da API.

## Consequências

**A favor**

- Qualquer réplica de qualquer serviço acessa qualquer arquivo.
- A API permanece sem estado: nada no disco local para preservar entre deploys.
- Trocar MinIO por S3 é uma mudança de variável de ambiente, não de código.
- Um upload de 500 MB consome memória constante.

**Contra**

- Mais um componente na infraestrutura local.
- O download passa pela API em vez de vir direto do storage. Uma URL pré-assinada seria mais
  barata, mas exigiria CORS no bucket e expiração de link — trabalho que não se paga nesta escala.
  A API faz stream do objeto, sem bufferizar.
