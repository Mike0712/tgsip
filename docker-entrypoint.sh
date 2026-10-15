#!/bin/sh
set -e

# Если .next отсутствует или пустой (например, перекрыт томом) — собираем заново.
# BUILD_ID создаётся только завершённым `next build`.
if [ ! -f .next/BUILD_ID ] || [ ! -f .next/server/middleware-manifest.json ]; then
  echo "⚠️  .next не найден или неполный — запускаю next build"
  node node_modules/next/dist/bin/next build
fi

exec "$@"
