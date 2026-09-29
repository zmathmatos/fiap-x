# ADR 0002 — Vídeos e zips em object storage

**Data:** 2026-09-01
**Status:** aceito — ver _Atualização_ no fim: o test double local passou a ser o S3Mock

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
- Trocar o test double local por S3 é uma mudança de variável de ambiente, não de código.
- Um upload de 500 MB consome memória constante.

**Contra**

- Mais um componente na infraestrutura local.
- O download passa pela API em vez de vir direto do storage. Uma URL pré-assinada seria mais
  barata, mas exigiria CORS no bucket e expiração de link — trabalho que não se paga nesta escala.
  A API faz stream do objeto, sem bufferizar.

## Atualização — 2026-09-28

O papel de "S3 em desenvolvimento" deixou de ser cumprido pelo MinIO e passou a ser cumprido pelo
**S3Mock** (`adobe/s3mock`). As imagens do MinIO no Docker Hub e no quay.io passaram a exigir pull
autenticado em todas as tags, o que quebrava `make up` e o CI. O S3Mock continua livre para pull e
cria os dois buckets no boot, dispensando o container de init.

A decisão de fundo não muda: object storage compatível com S3, endereçado só por variável de
ambiente. Em produção continua sendo o S3.
