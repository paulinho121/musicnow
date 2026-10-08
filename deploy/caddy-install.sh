#!/bin/bash
# Instala a configuração do Caddy (roda NA VM). Usado pelo deploy da produção e do teste.
# Uso: DOMAIN=... OLD_DOMAIN=... bash caddy-install.sh /tmp/ensaio-facil.caddy
set -euo pipefail
SRC="${1:?informe o arquivo .caddy}"
sed "s/__OLD_DOMAIN__/$OLD_DOMAIN/g; s/__DOMAIN__/$DOMAIN/g" "$SRC" > "$SRC.final"
# Só recarrega se a configuração mudou e for válida.
if ! sudo cmp -s "$SRC.final" /etc/caddy/ensaio-facil.caddy; then
  sudo cp /etc/caddy/ensaio-facil.caddy /etc/caddy/ensaio-facil.caddy.bak 2>/dev/null || true
  sudo install -m 644 "$SRC.final" /etc/caddy/ensaio-facil.caddy
  if sudo caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
    sudo systemctl reload caddy
    echo "Configuração do Caddy atualizada."
  else
    echo "Configuração do Caddy inválida: mantendo a anterior."
    [ -f /etc/caddy/ensaio-facil.caddy.bak ] && sudo mv /etc/caddy/ensaio-facil.caddy.bak /etc/caddy/ensaio-facil.caddy
    sudo caddy validate --config /etc/caddy/Caddyfile 2>&1 | tail -3
    rm -f "$SRC.final"
    exit 1
  fi
fi
rm -f "$SRC.final"
