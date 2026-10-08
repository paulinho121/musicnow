#!/bin/bash
# Publica a versão de TESTE (https://teste.ensaiofacil.app.br) a partir do PC, com o código
# da branch atual. Banco, API e pastas separados da produção: nada aqui afeta os usuários.
# Uso: npm run deploy:teste   (no PowerShell)   ou   bash deploy/deploy-teste.sh   (Git Bash)
#
# A configuração do Caddy (que já atende o endereço de teste) só é instalada pelo deploy da
# produção (deploy/deploy.sh), para o teste nunca mexer no servidor da produção.
set -euo pipefail

HOST="${DEPLOY_HOST:-ubuntu@152.67.63.31}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/paulinhoben10.key}"
SITE="https://teste.ensaiofacil.app.br"

cd "$(dirname "$0")/.."
echo "== branch: $(git rev-parse --abbrev-ref HEAD) ($(git rev-parse --short HEAD))"

echo "== testes e build (versão de teste)"
npm test --silent
VITE_SITE_URL="$SITE" VITE_APP_ENV=teste npm run build --silent

echo "== empacotando"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
bash deploy/make-bundle.sh "$TMP/bundle.tgz"

echo "== instalando no teste"
ssh -i "$KEY" -o BatchMode=yes "$HOST" "sudo /usr/local/bin/ensaio-deploy-artifact teste" < "$TMP/bundle.tgz"

echo "== publicado: $SITE"
