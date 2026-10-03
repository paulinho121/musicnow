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
2. Crie `apps/api/.env` a partir de `apps/api/.env.example`. Use o banco de **desenvolvimento** (`~/.pgvm/ensaio_facil_dev.env`) — nunca o de produção.
3. Em dois terminais:
   ```bash
   npm run dev:api
   npm run dev:web
   ```
4. Abra http://localhost:5173

Contas de demonstração: e-mails no topo de `apps/api/src/seed.ts`; a senha é o `SEED_PASSWORD` do seu `.env` (em produção, veja `~/.pgvm/contas-demo.txt`).

## Comandos

| Comando | Faz |
| --- | --- |
| `npm test` | Testes da lógica de cifras e permissões |
| `npm run test:api` | Testes da API (permissões de repertório). Precisa do túnel aberto; usa só o banco de dev |
| `npm run typecheck` | Checagem de tipos de todos os pacotes |
| `npm run db:generate` | Gera migração depois de mudar `apps/api/src/db/schema.ts` |
| `npm run db:migrate` | Aplica migrações (a API também aplica ao iniciar) |
| `npm run db:seed` | Recria os dados de demonstração |
| `npm run deploy` | Publica do PC, incluindo mudanças de configuração do servidor (Caddy, backup) |
| `npm run backup:baixar` | Baixa para o PC os backups de produção |

## Publicação automática

Cada `git push` na `main` roda o GitHub Actions (`.github/workflows/deploy.yml`): testes, checagem de tipos, build e publicação na VM. Se algo falhar, nada é publicado; se a API nova não subir na VM, ela volta sozinha para a versão anterior. Acompanhe em GitHub → Actions.

A chave SSH do GitHub (segredo `DEPLOY_SSH_KEY`) só consegue rodar `/usr/local/bin/ensaio-deploy-artifact` na VM — não abre terminal nem roda outros comandos. Mudanças na configuração do servidor (`deploy/setup-vm.sh`, `deploy/caddy/`, `deploy/pg-backup.sh`) continuam exigindo `npm run deploy` pelo PC.

## Tempo real e Modo Palco

Cada repertório aberto mantém uma conexão ao vivo (Server-Sent Events em `GET /api/setlists/:id/events`). Por ela chegam, na hora, as alterações do repertório, as marcações da banda, quem está conectado e o **Modo Palco**: quem administra toca em "Comandar a banda" e os aparelhos que estão seguindo mudam de música (e de seção) junto. A central fica em memória (`apps/api/src/realtime.ts`), no único processo da API; se a API reiniciar, os aparelhos reconectam sozinhos e o líder retoma a posição. Sem conexão ao vivo, o app volta a checar a revisão a cada 15 s.

## Exportar e integrações

- **ChordPro (.cho)**: cada música (no tom atual) e o repertório inteiro (nos tons do repertório), num formato que OnSong, SongbookPro e Planning Center abrem. A exportação e o importador fazem ida e volta sem perder o alinhamento dos acordes.
- **Imprimir / PDF**: `/musicas/:id/imprimir` e `/repertorios/:id/imprimir` usam a impressão do navegador ("Salvar como PDF"), em cores claras e uma música por página.
- **MusicBrainz** (`apps/api/src/routes/catalog.ts`): preenche artista e compositores. Só metadados, nunca letra ou cifra. As consultas passam pelo servidor (1 por segundo para o app inteiro, com cache e novas tentativas).
- **Gravação de referência**: link do YouTube tocado no player oficial (`youtube-nocookie.com`, o único site liberado em `frame-src`).

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
- Bancos: `ensaio_facil` (produção) e `ensaio_facil_dev` (desenvolvimento), com usuários separados
- Backup: diário às 03:00 em `/var/backups/postgres` (7 dias). Para mandar também ao Object Storage, preencha `BACKUP_PAR_URL` em `/etc/ensaio-facil/backup.env`
- Caddy do site: `deploy/caddy/ensaio-facil.caddy` (instalado a cada deploy, com CSP e HSTS)

## E-mail (recuperação de senha)

Preencha no `/etc/ensaio-facil/api.env` da VM e reinicie (`sudo systemctl restart ensaio-api`):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=senha-de-app-de-16-letras
MAIL_FROM="Ensaio Fácil <seu-email@gmail.com>"
```

Sem isso, a tela "Esqueci minha senha" avisa que a recuperação não está ativa.
