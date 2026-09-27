# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/notification-service/package.json apps/notification-service/
RUN npm ci

COPY packages/shared packages/shared
COPY apps/notification-service apps/notification-service
RUN npm run build -w @fiapx/shared && npm run build -w @fiapx/notification-service

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN apk add --no-cache tini

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/notification-service/package.json apps/notification-service/
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/apps/notification-service/dist apps/notification-service/dist

USER 1000:1000
EXPOSE 9101

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/notification-service/dist/worker.js"]
