FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
# Устанавливаем зависимости (кеш npm работает автоматически через BuildKit)
RUN npm ci --prefer-offline --no-audit

FROM node:20-slim AS builder
WORKDIR /app
# ARG для переменных, которые нужны во время сборки
ARG NEXT_PUBLIC_SSE_SERVER_URL
ARG NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
ARG NEXT_PUBLIC_APP_URL
# Преобразуем ARG в ENV для использования в npm run build
ENV NEXT_PUBLIC_SSE_SERVER_URL=${NEXT_PUBLIC_SSE_SERVER_URL}
ENV NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=${NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Отладочная информация - проверяем что переменные доступны перед сборкой
RUN echo "🔍 Checking env vars before build:" && \
    echo "NEXT_PUBLIC_SSE_SERVER_URL=${NEXT_PUBLIC_SSE_SERVER_URL}" && \
    echo "NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=${NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}" && \
    echo "NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}" && \
    env | grep NEXT_PUBLIC || echo "⚠️ No NEXT_PUBLIC vars found!"
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
COPY --from=builder /app/public ./public
COPY --from=builder /app/knexfile.js ./knexfile.js
COPY --from=builder /app/tsconfig.json ./tsconfig.json
# Конфиги, нужные для `next build` в рантайме (fallback в docker-entrypoint.sh)
COPY --from=builder /app/tailwind.config.ts ./tailwind.config.ts
COPY --from=builder /app/postcss.config.mjs ./postcss.config.mjs
COPY --from=builder /app/.eslintrc.json ./.eslintrc.json
COPY --from=builder /app/components.json ./components.json
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh
# Полный src/ (не только migrations) — нужен src/workers/telegramPoller.ts,
# который запускается тут же через tsx, а не как часть next start.
COPY --from=builder /app/src ./src
# Копируем только production node_modules (быстрее чем переустановка)
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
ENV NODE_ENV=production
ENTRYPOINT ["/usr/bin/tini", "--", "/app/docker-entrypoint.sh"]
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]