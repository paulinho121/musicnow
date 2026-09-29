#!/bin/bash
# Publica o Ensaio Fácil na VM: builda no PC, envia e reinicia a API.
# Uso (Git Bash, na raiz do projeto):  bash deploy/deploy.sh
set -euo pipefail

HOST="${DEPLOY_HOST:-ubuntu@152.67.63.31}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/paulinhoben10.key}"
DOMAIN="${DEPLOY_DOMAIN:-ensaio.152-67-63-31.sslip.io}"
SSH="ssh -i $KEY -o BatchMode=yes"

cd "$(dirname "$0")/.."

echo "== testes e build"
npm test --silent
npm run build --silent

echo "== empacotando"
TMP=$(mktemp -d)
tar -czf "$TMP/api.tgz" -C apps/api/dist index.js index.js.map -C .. drizzle
tar -czf "$TMP/web.tgz" -C apps/web/dist .

echo "== enviando para $HOST"
scp -q -i "$KEY" -o BatchMode=yes "$TMP/api.tgz" "$TMP/web.tgz" deploy/setup-vm.sh deploy/pg-backup.sh deploy/caddy/ensaio-facil.caddy "$HOST:/tmp/"
rm -rf "$TMP"

$SSH "$HOST" "DOMAIN=$DOMAIN bash -s" <<'REMOTE'
set -euo pipefail
cd /
# Configuração da VM (idempotente: só muda o que estiver diferente).
bash /tmp/setup-vm.sh "$DOMAIN" >/dev/null

# Caddy: instala o site do projeto e só recarrega se a configuração mudou e for válida.
sed "s/__DOMAIN__/$DOMAIN/g" /tmp/ensaio-facil.caddy > /tmp/ensaio-facil.caddy.final
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
rm -f /tmp/ensaio-facil.caddy /tmp/ensaio-facil.caddy.final

# API: troca os arquivos e reinicia (as migrações rodam na inicialização).
rm -rf /opt/ensaio-facil/api.new && mkdir -p /opt/ensaio-facil/api.new
tar -xzf /tmp/api.tgz -C /opt/ensaio-facil/api.new
rm -rf /opt/ensaio-facil/api.old
[ -d /opt/ensaio-facil/api ] && mv /opt/ensaio-facil/api /opt/ensaio-facil/api.old
mv /opt/ensaio-facil/api.new /opt/ensaio-facil/api
sudo systemctl restart ensaio-api

# Front: substitui de uma vez para ninguém pegar metade dos arquivos.
rm -rf /var/www/ensaio-facil.new && mkdir -p /var/www/ensaio-facil.new
tar -xzf /tmp/web.tgz -C /var/www/ensaio-facil.new
rm -rf /var/www/ensaio-facil.old
mv /var/www/ensaio-facil /var/www/ensaio-facil.old && mv /var/www/ensaio-facil.new /var/www/ensaio-facil
rm -f /tmp/api.tgz /tmp/web.tgz

for i in $(seq 1 20); do
  curl -sf http://127.0.0.1:3001/api/health >/dev/null && break
  sleep 1
done
if ! curl -sf http://127.0.0.1:3001/api/health >/dev/null; then
  echo "A API não subiu. Últimas linhas do log:"
  sudo journalctl -u ensaio-api -n 30 --no-pager
  exit 1
fi
echo "API no ar. Memória da API: $(systemctl show ensaio-api -p MemoryCurrent --value | numfmt --to=iec)"
REMOTE

echo "== publicado: https://$DOMAIN"
