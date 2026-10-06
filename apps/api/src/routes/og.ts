// Prévia dos links no WhatsApp, Facebook, Telegram...: os robôs não rodam o app, só leem o
// HTML. Para os links de convite e de música compartilhada, o Caddy pede a página aqui: é o
// mesmo index.html do app, com o título e a descrição daquele repertório ou música.
// Quem abre no navegador recebe o app normal (as etiquetas só mudam o cartão da prévia).
import { eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { db, schema } from '../db'
import { env } from '../env'
import { loadValidInvite } from './setlists'

const { song, user, setlistItem } = schema

/** Onde está o index.html do app (no servidor: pasta do Caddy; no desenvolvimento: o build). */
const WEB_INDEX = [env.WEB_ROOT, '/var/www/ensaio-facil', path.resolve('../web/dist')]
  .filter(Boolean)
  .map((d) => path.join(d!, 'index.html'))
  .find((f) => existsSync(f))

let cached: { mtime: number; html: string } | null = null
function template() {
  if (!WEB_INDEX) return null
  const mtime = statSync(WEB_INDEX).mtimeMs
  // Lê de novo quando sai uma versão nova do app.
  if (!cached || cached.mtime !== mtime) cached = { mtime, html: readFileSync(WEB_INDEX, 'utf8') }
  return cached.html
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Troca título, descrição e endereço da prévia; não indexa (convites são pessoais). */
export function withPreview(html: string, p: { title: string; description: string; url: string }) {
  const meta = (attr: string, name: string, value: string) => (h: string) =>
    h.replace(new RegExp(`(<meta\\s+${attr}="${name}"\\s+content=")[^"]*(")`), `$1${esc(value)}$2`)
  let out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(p.title)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(p.description)}" />`)
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:description" content="${esc(p.description)}" />`,
    )
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${esc(p.url)}$2`)
  for (const f of [
    meta('property', 'og:title', p.title),
    meta('property', 'og:url', p.url),
    meta('name', 'twitter:title', p.title),
    meta('name', 'twitter:description', p.description),
  ])
    out = f(out)
  return out.replace('</head>', '    <meta name="robots" content="noindex" />\n  </head>')
}

const whenFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

async function invitePreview(code: string) {
  const row = await loadValidInvite(code).catch(() => null)
  if (!row) return null
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(setlistItem)
    .where(eq(setlistItem.setlistId, row.invite.setlistId))
  const parts = [
    `${row.ownerName.split(' ')[0]} te chamou para tocar`,
    n ? `${n} ${n === 1 ? 'música' : 'músicas'}` : null,
    row.eventDate
      ? whenFmt
          .format(row.eventDate)
          .replace(':00', 'h')
          .replace(/(\d{2}):(\d{2})$/, '$1h$2')
      : null,
    row.location,
  ].filter(Boolean)
  return {
    title: `Convite: ${row.setlistName}${row.groupName ? ` · ${row.groupName}` : ''}`,
    description: `${parts.join(' · ')}. Abra para ver as músicas, os tons e o Modo Palco no Ensaio Fácil.`,
  }
}

async function songPreview(code: string) {
  if (!/^[A-Z2-9]{10}$/.test(code)) return null
  const [row] = await db
    .select({ title: song.title, artist: song.artist, key: song.originalKey, ownerName: user.name })
    .from(song)
    .innerJoin(user, eq(user.id, song.ownerId))
    .where(eq(song.shareCode, code))
  if (!row) return null
  return {
    title: `${row.title}${row.artist ? ` · ${row.artist}` : ''}${row.key ? ` (tom ${row.key})` : ''}`,
    description: `${row.ownerName.split(' ')[0]} compartilhou esta cifra com você no Ensaio Fácil. Abra para tocar em qualquer tom.`,
  }
}

export const ogRoutes = new Hono().get('/:kind{convite|compartilhado}/:code', async (c) => {
  const html = template()
  if (!html) return c.text('Página indisponível.', 503)
  const code = c.req.param('code').trim().toUpperCase()
  const preview = c.req.param('kind') === 'convite' ? await invitePreview(code) : await songPreview(code)
  const url = `${env.APP_URL}/${c.req.param('kind')}/${encodeURIComponent(c.req.param('code'))}`
  return c.html(preview ? withPreview(html, { ...preview, url }) : html, 200, { 'Cache-Control': 'no-cache' })
})
