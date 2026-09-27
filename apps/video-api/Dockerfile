# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app

# Manifests first so the dependency layer survives source-only changes.
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/video-api/package.json apps/video-api/
RUN npm ci

COPY packages/shared packages/shared
COPY apps/video-api apps/video-api
RUN npm run build -w @fiapx/shared && npm run build -w @fiapx/video-api

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN apk add --no-cache tini

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/video-api/package.json apps/video-api/
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/apps/video-api/dist apps/video-api/dist

# Numeric UID (the `node` user): com um nome, o kubelet não consegue provar que
# o usuário não é root e recusa o pod com runAsNonRoot.
USER 1000:1000
EXPOSE 3000

# tini reaps zombies and forwards SIGTERM, which the graceful shutdown depends on.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/video-api/dist/server.js"]
