// Prévia dos links de convite e de música compartilhada (WhatsApp, redes).
// Usa um index.html de mentira (não depende do build do app). Banco de desenvolvimento.
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const webRoot = mkdtempSync(path.join(tmpdir(), 'ef-web-'))
writeFileSync(
  path.join(webRoot, 'index.html'),
  `<!doctype html><html><head>
<meta name="description" content="Geral" />
<title>Ensaio Fácil</title>
<link rel="canonical" href="https://exemplo/" />
<meta property="og:url" content="https://exemplo/" />
<meta property="og:title" content="Ensaio Fácil" />
<meta property="og:description" content="Geral" />
<meta name="twitter:title" content="Ensaio Fácil" />
<meta name="twitter:description" content="Geral" />
</head><body><div id="root"></div></body></html>`,
)
process.env.WEB_ROOT = webRoot

const { app } = await import('../src/app')
const { client } = await import('../src/db')

const ORIGIN = process.env.APP_URL!
const DOMAIN = 'teste.ensaiofacil.app'
const run = randomBytes(4).toString('hex')

type User = { cookie: string; id: string }
async function call(u: User, method: string, p: string, body?: unknown) {
  const res = await app.request(`/api${p}`, {
    method,
    headers: { origin: ORIGIN, cookie: u.cookie, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, data: text ? JSON.parse(text) : null }
}

let lider: User
let inviteCode: string, shareCode: string

beforeAll(async () => {
  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Marina Lima', email: `lider-${run}@${DOMAIN}`, password: `senha-${run}` }),
  })
  lider = {
    cookie: res.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; '),
    id: (await res.json()).user.id,
  }
  const setlistId = (
    await call(lider, 'POST', '/setlists', { name: `Baile de Sexta ${run}`, location: 'Bar do Zé', eventDate: '2026-10-16T23:00:00.000Z' })
  ).data.id
  const songId = (
    await call(lider, 'POST', '/songs', { title: `Fada ${run}`, artist: 'Henrique & Juliano', originalKey: 'A', content: '[Intro] A' })
  ).data.id
  await call(lider, 'POST', `/setlists/${setlistId}/items`, { songId })
  inviteCode = (await call(lider, 'POST', `/setlists/${setlistId}/invites`, { permission: 'view' })).data.code
  shareCode = (await call(lider, 'POST', `/songs/${songId}/share`, {})).data.url.split('/').pop()
})

afterAll(async () => {
  await client`delete from setlist where owner_id in (select id from "user" where email like ${'%-' + run + '@' + DOMAIN})`
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

const page = async (p: string) => {
  const res = await app.request(`/api/og${p}`)
  return { status: res.status, html: await res.text() }
}
const tag = (html: string, prop: string) => new RegExp(`property="${prop}" content="([^"]*)"`).exec(html)?.[1]

describe('prévia dos links', () => {
  it('convite: nome do repertório, quem chamou, músicas, data e local', async () => {
    const { status, html } = await page(`/convite/${inviteCode}`)
    expect(status).toBe(200)
    expect(html).toContain(`<title>Convite: Baile de Sexta ${run}</title>`)
    const desc = tag(html, 'og:description')!
    expect(desc).toContain('Marina te chamou para tocar')
    expect(desc).toContain('1 música')
    expect(desc).toContain('16 de outubro')
    expect(desc).toContain('20h')
    expect(desc).toContain('Bar do Zé')
    expect(html).toContain('<meta name="robots" content="noindex" />')
    expect(html).toContain('<div id="root"></div>')
  })

  it('música compartilhada: título, artista e tom', async () => {
    const { html } = await page(`/compartilhado/${shareCode}`)
    expect(tag(html, 'og:title')).toBe(`Fada ${run} · Henrique &amp; Juliano (tom A)`)
    expect(tag(html, 'og:description')).toContain('Marina compartilhou esta cifra')
  })

  it('código inválido: página normal do app (sem dados de ninguém)', async () => {
    const { status, html } = await page('/convite/NAOEXISTE1')
    expect(status).toBe(200)
    expect(html).toContain('<title>Ensaio Fácil</title>')
    expect(html).not.toContain('noindex')
  })
})
