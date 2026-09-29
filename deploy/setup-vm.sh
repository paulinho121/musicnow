#!/bin/bash
# Configuração inicial da VM (roda NA VM, como ubuntu). Pode rodar de novo sem problema.
# Pré-requisitos já feitos: Caddy e PostgreSQL 17 instalados, banco/usuário ensaio_facil.
set -euo pipefail
cd /
DOMAIN="${1:?informe o domínio, ex.: ensaio.152-67-63-31.sslip.io}"

echo "== Node.js 22"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1)" != "v22" ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - >/dev/null
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs >/dev/null
fi
node -v

echo "== usuário de serviço e pastas"
id ensaio >/dev/null 2>&1 || sudo useradd --system --no-create-home --shell /usr/sbin/nologin ensaio
sudo mkdir -p /opt/ensaio-facil/api /var/www/ensaio-facil /var/lib/ensaio-facil/uploads /etc/ensaio-facil
sudo chown -R ubuntu:ubuntu /opt/ensaio-facil /var/www/ensaio-facil
sudo chown -R ensaio:ensaio /var/lib/ensaio-facil

echo "== variáveis de ambiente (segredos ficam só na VM)"
if [ ! -f /etc/ensaio-facil/api.env ]; then
  PASS=$(cat ~/.pg-ensaio_facil.pass)
  sudo tee /etc/ensaio-facil/api.env >/dev/null <<EOF
DATABASE_URL=postgresql://ensaio_facil:${PASS}@localhost:5432/ensaio_facil
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
APP_URL=https://${DOMAIN}
PORT=3001
UPLOAD_DIR=/var/lib/ensaio-facil/uploads
MIGRATIONS_DIR=/opt/ensaio-facil/api/drizzle
NODE_ENV=production
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
EOF
  sudo chown root:ensaio /etc/ensaio-facil/api.env
  sudo chmod 640 /etc/ensaio-facil/api.env
fi

echo "== serviço systemd"
sudo tee /etc/systemd/system/ensaio-api.service >/dev/null <<'EOF'
[Unit]
Description=Ensaio Fácil API
After=network.target postgresql.service
Requires=postgresql.service

[Service]
User=ensaio
Group=ensaio
WorkingDirectory=/opt/ensaio-facil/api
EnvironmentFile=/etc/ensaio-facil/api.env
Environment="NODE_OPTIONS=--max-old-space-size=160 --enable-source-maps"
ExecStart=/usr/bin/node /opt/ensaio-facil/api/index.js
Restart=always
RestartSec=3
# A VM tem 1 GB: limita a API para não derrubar o Postgres.
MemoryMax=220M
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/ensaio-facil

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable ensaio-api >/dev/null 2>&1

echo "== script de publicação (usado pelo deploy manual e pelo GitHub Actions)"
if [ -f /tmp/ci-deploy.sh ]; then
  sudo install -o root -g root -m 755 /tmp/ci-deploy.sh /usr/local/bin/ensaio-deploy-artifact
fi

echo "== backup do banco"
if [ -f /tmp/pg-backup.sh ]; then
  sudo install -m 755 /tmp/pg-backup.sh /usr/local/bin/pg-backup
  echo '0 3 * * * postgres /usr/local/bin/pg-backup >> /var/log/pg-backup.log 2>&1' | sudo tee /etc/cron.d/pg-backup >/dev/null
  sudo touch /var/log/pg-backup.log && sudo chown postgres:postgres /var/log/pg-backup.log
fi
if [ ! -f /etc/ensaio-facil/backup.env ]; then
  sudo tee /etc/ensaio-facil/backup.env >/dev/null <<'EOF'
# URL de "pre-authenticated request" (PAR) de um bucket do Object Storage da Oracle,
# com permissão de escrita. Com ela preenchida, o backup diário vai também para fora da VM.
# BACKUP_PAR_URL=https://objectstorage.sa-saopaulo-1.oraclecloud.com/p/.../n/.../b/.../o/
EOF
  sudo chown root:postgres /etc/ensaio-facil/backup.env
  sudo chmod 640 /etc/ensaio-facil/backup.env
fi

echo "== Caddy"
# O site fica num arquivo próprio (/etc/caddy/ensaio-facil.caddy), atualizado a cada deploy.
# Versões antigas deste script colavam o bloco no fim do Caddyfile: remove esse bloco.
if grep -q '^# ensaio-facil$' /etc/caddy/Caddyfile; then
  sudo sed -i '/^# ensaio-facil$/,$d' /etc/caddy/Caddyfile
fi
if ! grep -q 'import /etc/caddy/ensaio-facil.caddy' /etc/caddy/Caddyfile; then
  printf '\nimport /etc/caddy/ensaio-facil.caddy\n' | sudo tee -a /etc/caddy/Caddyfile >/dev/null
fi
echo "VM pronta para o deploy."
