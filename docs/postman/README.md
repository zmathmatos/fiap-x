# Coleção Postman

`fiapx.postman_collection.json` documenta a API do FIAP X. Cada serviço com
superfície HTTP tem sua própria pasta na coleção:

- **Video API** — a API de domínio (`/auth/*`, `/me`, `/videos/*`) mais os
  endpoints de `/health`, `/health/ready` e `/metrics`.
- **Video Processor** — worker sem API de domínio; expõe só
  `/health`, `/health/ready` e `/metrics`.
- **Notification Service** — worker sem API de domínio; expõe só
  `/health`, `/health/ready` e `/metrics`.

## Como usar

1. Importe `fiapx.postman_collection.json` no Postman (File → Import).
2. Suba o ambiente local: `cp env.example .env && make up` (ver README na raiz).
3. As variáveis de coleção já apontam para as portas padrão do `docker-compose`:
   - `videoApiBaseUrl` → `http://localhost:3000`
   - `videoProcessorBaseUrl` → `http://localhost:9100`
   - `notificationServiceBaseUrl` → `http://localhost:9101`
4. Rode **Video API → Auth → Registrar usuário** (ou **Login**). O token é
   salvo automaticamente na variável `authToken` e reutilizado pelas demais
   requisições da Video API.
5. Rode **Video API → Videos → Enviar vídeo** para salvar o `videoId` usado
   pelas requisições de detalhe, renomear, download e thumbnail.

A coleção não precisa de arquivo de ambiente separado — os valores padrão
já ficam nas variáveis de coleção. Se algum serviço rodar em outra porta,
edite essas variáveis em Postman (aba *Variables* da coleção).
