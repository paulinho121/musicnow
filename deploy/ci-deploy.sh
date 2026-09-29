#!/bin/bash
# Instalado em /usr/local/bin/ensaio-deploy-artifact (dono root) pelo setup-vm.sh.
#
# Recebe pela entrada padrão um .tar.gz com:
#   api/index.js, api/index.js.map, api/drizzle/...   (a API empacotada + migrações)
#   web/index.html, web/assets/...                    (o app)
# troca as versões, reinicia a API e confere a saúde. Se a API não subir, volta
# sozinho para a versão anterior.
#
# A chave SSH do GitHub Actions só consegue rodar ESTE script (command= no
# authorized_keys): não abre terminal nem executa outros comandos. Por isso ele
# nunca executa nada que venha dentro do pacote — só copia arquivos.
set -euo pipefail
umask 022
cd /

MAX_BYTES=$((60 * 1024 * 1024))
BASE=/opt/ensaio-facil
WEB=/var/www/ensaio-facil
TMP=$(mktemp -d /tmp/ensaio-deploy.XXXXXX)
trap 'rm -rf "$TMP"' EXIT

log() { echo "[$(date +%H:%M:%S)] $*"; }

log "Recebendo pacote..."
head -c "$MAX_BYTES" > "$TMP/bundle.tgz"
if [ "$(stat -c %s "$TMP/bundle.tgz")" -ge "$MAX_BYTES" ]; then
  echo "Pacote grande demais (limite de 60 MB)." >&2
  exit 1
fi

# Só caminhos relativos e esperados; nada de links simbólicos.
if tar -tzf "$TMP/bundle.tgz" | grep -Ev '^(\./)?(api|web)(/|$)' | grep -q .; then
  echo "Pacote com arquivos fora de api/ e web/: recusado." >&2
  exit 1
fi
mkdir -p "$TMP/x"
tar -xzf "$TMP/bundle.tgz" -C "$TMP/x" --no-same-owner --no-same-permissions
if find "$TMP/x" -type l | grep -q .; then
  echo "Pacote com links simbólicos: recusado." >&2
  exit 1
fi
[ -f "$TMP/x/api/index.js" ] && [ -d "$TMP/x/api/drizzle" ] || { echo "Pacote sem a API (api/index.js, api/drizzle)." >&2; exit 1; }
[ -f "$TMP/x/web/index.html" ] || { echo "Pacote sem o app (web/index.html)." >&2; exit 1; }

swap() { # swap <novo> <destino>
  rm -rf "$2.old"
  [ -d "$2" ] && mv "$2" "$2.old"
  mv "$1" "$2"
  chown -R ubuntu:ubuntu "$2"
}

healthy() {
  for _ in $(seq 1 25); do
    curl -sf http://127.0.0.1:3001/api/health >/dev/null && return 0
    sleep 1
  done
  return 1
}

log "Instalando a API..."
rm -rf "$BASE/api.new" && mv "$TMP/x/api" "$BASE/api.new"
swap "$BASE/api.new" "$BASE/api"
systemctl restart ensaio-api

if ! healthy; then
  log "A API nova não respondeu. Voltando para a versão anterior..."
  journalctl -u ensaio-api -n 25 --no-pager || true
  if [ -d "$BASE/api.old" ]; then
    rm -rf "$BASE/api.failed" && mv "$BASE/api" "$BASE/api.failed" && mv "$BASE/api.old" "$BASE/api"
    systemctl restart ensaio-api
    healthy && log "Versão anterior restaurada. O site continua no ar."
  fi
  exit 1
fi

# O app só é trocado depois que a API nova está de pé (as duas versões andam juntas).
log "Instalando o app..."
rm -rf "$WEB.new" && mv "$TMP/x/web" "$WEB.new"
swap "$WEB.new" "$WEB"

log "Publicado. Memória da API: $(systemctl show ensaio-api -p MemoryCurrent --value | numfmt --to=iec)"
