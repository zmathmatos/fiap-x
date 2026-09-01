COMPOSE = docker compose -f infra/docker-compose.yml

.PHONY: up down logs ps scale rebuild test lint build clean

## Sobe o ambiente completo (leva alguns minutos no primeiro build)
up:
	$(COMPOSE) up -d --build

## Derruba tudo e apaga os volumes
down:
	$(COMPOSE) down -v

## Acompanha os logs da API e dos workers
logs:
	$(COMPOSE) logs -f video-api video-processor notification

## Mostra o estado dos containers
ps:
	$(COMPOSE) ps

## Sobe para 4 workers — usado na demonstração de escala
scale:
	$(COMPOSE) up -d --scale video-processor=4

## Reconstrói as imagens da aplicação sem derrubar a infraestrutura
rebuild:
	$(COMPOSE) up -d --build video-api video-processor notification web

## Testes unitários de todos os workspaces
test:
	npm run test:unit

## Lint do monorepo
lint:
	npx eslint . --ext .ts,.tsx

## Compila todos os workspaces
build:
	npm run build

## Remove artefatos de build e cobertura
clean:
	rm -rf packages/*/dist apps/*/dist apps/*/coverage packages/*/coverage
