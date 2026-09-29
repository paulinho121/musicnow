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

echo "== Caddy"
if ! grep -q "# ensaio-facil" /etc/caddy/Caddyfile; then
  sudo tee -a /etc/caddy/Caddyfile >/dev/null <<EOF

# ensaio-facil
${DOMAIN} {
	encode zstd gzip
	header {
		X-Content-Type-Options nosniff
		Referrer-Policy strict-origin-when-cross-origin
		-Server
	}

	handle /api/* {
		reverse_proxy 127.0.0.1:3001
	}

	handle {
		root * /var/www/ensaio-facil
		@static path /assets/*
		header @static Cache-Control "public, max-age=31536000, immutable"
		@fresh not path /assets/*
		header @fresh Cache-Control "no-cache"
		try_files {path} /index.html
		file_server
	}
}
EOF
  sudo caddy validate --config /etc/caddy/Caddyfile >/dev/null
  sudo systemctl reload caddy
fi
echo "VM pronta para o deploy."
