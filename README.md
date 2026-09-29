# Ensaio Fácil

Cifras, transposição instantânea e repertórios compartilhados para músicos de igreja, bandas e artistas.

Produção: https://ensaio.152-67-63-31.sslip.io (VM Oracle `paulinhoben10`)

## Estrutura

| Pasta | O que é |
| --- | --- |
| `packages/shared` | Lógica de cifras (detecção de acordes, transposição com alinhamento, seções) e vocabulário do domínio. Com testes. |
| `apps/api` | API Node: Hono + Drizzle (PostgreSQL 17) + Better Auth. Empacotada num arquivo só para a VM. |
| `apps/web` | App React + Vite + Tailwind, instalável (PWA) e com cache offline das músicas já abertas. |
| `deploy/` | Configuração da VM e script de publicação. |

## Rodar localmente

1. Abra o túnel para o banco da VM (deixe a janela aberta):
   ```powershell
   powershell -ExecutionPolicy Bypass -File "$HOME\.pgvm\tunel-postgres.ps1"
   ```
2. Crie `apps/api/.env` a partir de `apps/api/.env.example` (a connection string está em `~/.pgvm/ensaio_facil.env`).
3. Em dois terminais:
   ```bash
   npm run dev:api
   npm run dev:web
   ```
4. Abra http://localhost:5173

Contas de demonstração: veja o topo de `apps/api/src/seed.ts`.

## Comandos

| Comando | Faz |
| --- | --- |
| `npm test` | Testes da lógica de cifras |
| `npm run typecheck` | Checagem de tipos de todos os pacotes |
| `npm run db:generate` | Gera migração depois de mudar `apps/api/src/db/schema.ts` |
| `npm run db:migrate` | Aplica migrações (a API também aplica ao iniciar) |
| `npm run db:seed` | Recria os dados de demonstração |
| `bash deploy/deploy.sh` | Testa, builda e publica na VM |

## Formato da cifra

Acordes na linha de cima da letra, seções entre colchetes:

```
[Intro] G  D  Em  C

[Refrão]
C       G/B     Am
Letra da música aqui
```

Aceita a notação brasileira (`7M`, `7(9)`, `m7(b5)`, `4`, `°`, baixo invertido `D/F#`) e marcações como `| C  G |` e `(x2)`.

## Na VM

- API: serviço `ensaio-api` (systemd), usuário `ensaio`, limite de 220 MB. Logs: `sudo journalctl -u ensaio-api -f`
- Variáveis e segredos: `/etc/ensaio-facil/api.env`
- Front: `/var/www/ensaio-facil` · Caddy: `/etc/caddy/Caddyfile`
- Backup do banco: diário às 03:00 em `/var/backups/postgres`
