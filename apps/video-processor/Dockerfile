# syntax=docker/dockerfile:1

FROM node:26-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/video-processor/package.json apps/video-processor/
RUN npm ci

COPY packages/shared packages/shared
COPY apps/video-processor apps/video-processor
RUN npm run build -w @fiapx/shared && npm run build -w @fiapx/video-processor

FROM node:26-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# ffmpeg and ffprobe are the whole reason this worker exists.
RUN apk add --no-cache ffmpeg tini

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/video-processor/package.json apps/video-processor/
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/apps/video-processor/dist apps/video-processor/dist

USER node
EXPOSE 9100

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/video-processor/dist/worker.js"]
