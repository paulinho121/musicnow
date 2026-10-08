#!/bin/bash
# Prepara a versão de teste (teste.ensaiofacil.app.br) na VM. Roda NA VM, como ubuntu.
# Pode rodar de novo sem problema: só cria o que ainda não existe.
#
# Tudo separado da produção: banco ensaio_facil_teste (usuário próprio), pastas
# /opt/ensaio-facil-teste e /var/www/ensaio-facil-teste, serviço ensaio-api-teste na
# porta 3002. Sem chave do Asaas (cobrança desligada) e sem e-mail (vai só para o log).
set -euo pipefail
cd /
DOMAIN="${1:-teste.ensaiofacil.app.br}"

echo "== banco de dados separado"
PASS_FILE=~/.pg-ensaio_teste.pass
[ -f "$PASS_FILE" ] || (umask 077 && openssl rand -hex 24 > "$PASS_FILE")
PASS=$(cat "$PASS_FILE")
if ! sudo -u postgres psql -Atc "select 1 from pg_roles where rolname = 'ensaio_teste'" | grep -q 1; then
  sudo -u postgres psql -qc "create role ensaio_teste login password '$PASS'"
fi
if ! sudo -u postgres psql -Atc "select 1 from pg_database where datname = 'ensaio_facil_teste'" | grep -q 1; then
  sudo -u postgres createdb -O ensaio_teste ensaio_facil_teste
fi

echo "== pastas"
sudo mkdir -p /opt/ensaio-facil-teste/api /var/www/ensaio-facil-teste /var/lib/ensaio-facil-teste/uploads
sudo chown -R ubuntu:ubuntu /opt/ensaio-facil-teste /var/www/ensaio-facil-teste
sudo chown -R ensaio:ensaio /var/lib/ensaio-facil-teste

echo "== variáveis de ambiente do teste"
if [ ! -f /etc/ensaio-facil/api-teste.env ]; then
  sudo tee /etc/ensaio-facil/api-teste.env >/dev/null <<EOF
DATABASE_URL=postgresql://ensaio_teste:${PASS}@localhost:5432/ensaio_facil_teste
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
APP_URL=https://${DOMAIN}
PORT=3002
UPLOAD_DIR=/var/lib/ensaio-facil-teste/uploads
MIGRATIONS_DIR=/opt/ensaio-facil-teste/api/drizzle
NODE_ENV=production
BILLING_ENFORCED=false
WEB_ROOT=/var/www/ensaio-facil-teste
EOF
  sudo chown root:ensaio /etc/ensaio-facil/api-teste.env
  sudo chmod 640 /etc/ensaio-facil/api-teste.env
fi

echo "== serviço systemd"
sudo tee /etc/systemd/system/ensaio-api-teste.service >/dev/null <<'EOF'
[Unit]
Description=Ensaio Fácil API (versão de teste)
After=network.target postgresql.service
Requires=postgresql.service

[Service]
User=ensaio
Group=ensaio
WorkingDirectory=/opt/ensaio-facil-teste/api
EnvironmentFile=/etc/ensaio-facil/api-teste.env
Environment="NODE_OPTIONS=--max-old-space-size=96 --enable-source-maps"
ExecStart=/usr/bin/node /opt/ensaio-facil-teste/api/index.js
Restart=always
RestartSec=3
# A VM tem 1 GB: o teste tem um limite menor que a produção.
MemoryMax=150M
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/ensaio-facil-teste

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable ensaio-api-teste >/dev/null 2>&1
echo "Teste pronto para o primeiro deploy."
