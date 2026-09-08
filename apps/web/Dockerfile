# syntax=docker/dockerfile:1

FROM node:26-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @fiapx/web --include-workspace-root

COPY apps/web apps/web
RUN npm run build -w @fiapx/web

FROM nginx:1.27-alpine AS runtime

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 8080
