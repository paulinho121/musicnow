#!/bin/bash
# Publica o Ensaio Fácil na VM a partir do PC: testa, builda, atualiza a
# configuração do servidor (Caddy, backup, scripts) e instala a nova versão.
# Uso: npm run deploy   (no PowerShell)   ou   bash deploy/deploy.sh   (Git Bash)
#
# O GitHub Actions faz a mesma instalação a cada push na main (.github/workflows/deploy.yml),
# mas sem tocar na configuração do servidor — isso fica só para este script.
set -euo pipefail

HOST="${DEPLOY_HOST:-ubuntu@152.67.63.31}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/paulinhoben10.key}"
DOMAIN="${DEPLOY_DOMAIN:-ensaiofacil.app.br}"
# Endereço antigo: continua funcionando, redirecionando para o novo (links já compartilhados).
OLD_DOMAIN="${DEPLOY_OLD_DOMAIN:-ensaio.152-67-63-31.sslip.io}"
SSH="ssh -i $KEY -o BatchMode=yes"

cd "$(dirname "$0")/.."

echo "== testes e build"
npm test --silent
npm run build --silent

echo "== empacotando"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
bash deploy/make-bundle.sh "$TMP/bundle.tgz"

echo "== atualizando a configuração do servidor"
scp -q -i "$KEY" -o BatchMode=yes deploy/setup-vm.sh deploy/pg-backup.sh deploy/ci-deploy.sh deploy/caddy/ensaio-facil.caddy "$HOST:/tmp/"
$SSH "$HOST" "DOMAIN=$DOMAIN OLD_DOMAIN=$OLD_DOMAIN bash -s" <<'REMOTE'
set -euo pipefail
cd /
# Configuração da VM (idempotente: só muda o que estiver diferente).
bash /tmp/setup-vm.sh "$DOMAIN" >/dev/null

# Caddy: instala o site do projeto e só recarrega se a configuração mudou e for válida.
sed "s/__OLD_DOMAIN__/$OLD_DOMAIN/g; s/__DOMAIN__/$DOMAIN/g" /tmp/ensaio-facil.caddy > /tmp/ensaio-facil.caddy.final
if ! sudo cmp -s /tmp/ensaio-facil.caddy.final /etc/caddy/ensaio-facil.caddy; then
  sudo cp /etc/caddy/ensaio-facil.caddy /etc/caddy/ensaio-facil.caddy.bak 2>/dev/null || true
  sudo install -m 644 /tmp/ensaio-facil.caddy.final /etc/caddy/ensaio-facil.caddy
  if sudo caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
    sudo systemctl reload caddy
    echo "Configuração do Caddy atualizada."
  else
    echo "Configuração do Caddy inválida: mantendo a anterior."
    [ -f /etc/caddy/ensaio-facil.caddy.bak ] && sudo mv /etc/caddy/ensaio-facil.caddy.bak /etc/caddy/ensaio-facil.caddy
    sudo caddy validate --config /etc/caddy/Caddyfile 2>&1 | tail -3
    exit 1
  fi
fi
rm -f /tmp/ensaio-facil.caddy /tmp/ensaio-facil.caddy.final /tmp/setup-vm.sh /tmp/pg-backup.sh /tmp/ci-deploy.sh
REMOTE

echo "== instalando a nova versão"
$SSH "$HOST" "sudo /usr/local/bin/ensaio-deploy-artifact" < "$TMP/bundle.tgz"

echo "== publicado: https://$DOMAIN"
