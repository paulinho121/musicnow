#!/bin/bash
# Backup diário do PostgreSQL (instalado em /usr/local/bin/pg-backup, roda às 03:00 como postgres).
# 1. Guarda 7 dias em /var/backups/postgres (restauração rápida), junto com as partituras
#    (arquivos em disco, fora do banco).
# 2. Se houver BACKUP_PAR_URL em /etc/ensaio-facil/backup.env, envia uma cópia para o
#    Object Storage da Oracle — assim o backup sobrevive mesmo se a VM for perdida.
set -euo pipefail
cd /
DIR=/var/backups/postgres
STAMP=$(date +%F)
FAILED=0

for db in $(psql -Atc "SELECT datname FROM pg_database WHERE NOT datistemplate AND datname <> 'postgres'"); do
  out="$DIR/$db-$STAMP.dump"
  pg_dump -Fc "$db" > "$out.tmp" && mv "$out.tmp" "$out"
done
find "$DIR" -name '*.dump' -mtime +7 -delete

# Arquivos enviados (partituras e imagens do início): ficam em disco, fora do banco,
# então vão num pacote à parte.
UPLOADS=/var/lib/ensaio-facil/uploads
SCORES_TAR="$DIR/arquivos-$STAMP.tar"
if [ -d "$UPLOADS" ] && [ -n "$(ls -A "$UPLOADS" 2>/dev/null)" ]; then
  # Já são WebP comprimido: tar sem gzip (mais rápido, mesmo tamanho).
  tar -cf "$SCORES_TAR.tmp" -C "$(dirname "$UPLOADS")" --exclude='*.tmp' "$(basename "$UPLOADS")" && mv "$SCORES_TAR.tmp" "$SCORES_TAR"
fi
find "$DIR" \( -name 'arquivos-*.tar' -o -name 'partituras-*.tar' \) -mtime +7 -delete

if [ -r /etc/ensaio-facil/backup.env ]; then
  # shellcheck disable=SC1091
  . /etc/ensaio-facil/backup.env
fi
if [ -n "${BACKUP_PAR_URL:-}" ]; then
  # Só a produção vai para fora; o banco de desenvolvimento pode ser recriado pelo seed.
  for f in "$DIR"/ensaio_facil-"$STAMP".dump "$SCORES_TAR"; do
    [ -f "$f" ] || continue
    name="$(hostname)/$(basename "$f")"
    if curl -sf -X PUT --data-binary @"$f" -H 'Content-Type: application/octet-stream' "${BACKUP_PAR_URL%/}/$name" >/dev/null; then
      echo "Enviado para o Object Storage: $name"
    else
      echo "FALHA ao enviar $name para o Object Storage" >&2
      FAILED=1
    fi
  done
fi
exit $FAILED
