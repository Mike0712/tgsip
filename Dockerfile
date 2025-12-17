FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
# Кешируем npm пакеты для ускорения последующих сборок
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
# tini для корректного PID1
RUN apt-get update && \
    apt-get install -y --no-install-recommends tini && \
    rm -rf /var/lib/apt/lists/*
# Копируем только нужные файлы (оптимизируем порядок для кеша)
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.mjs ./next.config.mjs
# Копируем только production node_modules (быстрее чем переустановка)
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
ENV NODE_ENV=production
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]