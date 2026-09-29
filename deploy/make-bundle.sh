#!/bin/bash
# Monta o pacote de publicação (depois do build): api/ + web/ num .tar.gz.
# Uso: bash deploy/make-bundle.sh saida.tgz
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:?informe o arquivo de saída}"
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/api" "$STAGE/web"
cp apps/api/dist/index.js apps/api/dist/index.js.map "$STAGE/api/"
cp -r apps/api/drizzle "$STAGE/api/drizzle"
cp -r apps/web/dist/. "$STAGE/web/"
tar -czf "$OUT" -C "$STAGE" api web
echo "Pacote: $OUT ($(du -h "$OUT" | cut -f1))"
