// Zerar os dados (configuração de fábrica): a conta continua, o conteúdo some e a música de
// exemplo volta; o repertório dos outros não quebra.
// Rodam contra o banco de desenvolvimento e apagam tudo o que criam no fim.
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const { app } = await import('../src/app')
const { client } = await import('../src/db')

const ORIGIN = process.env.APP_URL!
const DOMAIN = 'teste.ensaiofacil.app'
const run = randomBytes(4).toString('hex')

type User = { name: string; cookie: string; id: string }

async function call(u: User | null, method: string, path: string, body?: unknown) {
  const res = await app.request(`/api${path}`, {
    method,
    headers: {
      origin: ORIGIN,
      ...(u ? { cookie: u.cookie } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, data: text ? JSON.parse(text) : null }
}

async function signUp(name: string): Promise<User> {
  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ name, email: `${name}-${run}@${DOMAIN}`, password: `senha-${run}-${name}` }),
  })
  expect(res.status).toBe(200)
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
  const { user } = await res.json()
  return { name, cookie, id: user.id }
}

let ana: User, bia: User
let songId: string, ownSetlist: string, biaSetlist: string

beforeAll(async () => {
  ;[ana, bia] = await Promise.all(['ana', 'bia'].map(signUp))
  songId = (await call(ana, 'POST', '/songs', { title: `Cifra da Ana ${run}`, visibility: 'public', license: 'own', lyricsAuthorized: true, content: 'C  G\nletra' })).data.id
  ownSetlist = (await call(ana, 'POST', '/setlists', { name: `Show da Ana ${run}` })).data.id
  biaSetlist = (await call(bia, 'POST', '/setlists', { name: `Culto da Bia ${run}` })).data.id
  for (const [u, s] of [
    [ana, ownSetlist],
    [bia, biaSetlist],
  ] as const) {
    expect((await call(u, 'POST', `/setlists/${s}/items`, { songId, key: 'D' })).status).toBe(201)
  }
  expect((await call(ana, 'POST', `/songs/${songId}/favorite`)).status).toBeLessThan(300)
})

afterAll(async () => {
  await client`delete from setlist where owner_id in (select id from "user" where email like ${'%-' + run + '@' + DOMAIN})`
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('zerar os dados', () => {
  it('sem a palavra de confirmação: não apaga nada', async () => {
    expect((await call(ana, 'POST', '/me/reset', { confirm: 'zerar tudo' })).status).toBe(400)
    expect((await call(ana, 'GET', `/songs/${songId}`)).status).toBe(200)
  })

  it('apaga músicas e repertórios, mantém a conta e recria a música de exemplo', async () => {
    expect((await call(ana, 'POST', '/me/reset', { confirm: 'ZERAR' })).status).toBe(200)
    // Continua logada.
    expect((await call(ana, 'GET', '/me')).status).toBe(200)
    const songs = await client`select title from song where owner_id = ${ana.id}`
    expect(songs).toHaveLength(1)
    expect(songs[0].title).not.toContain(run)
    const [{ sets }] = await client`select count(*)::int as sets from setlist where owner_id = ${ana.id}`
    expect(sets).toBe(0)
    const [{ favs }] = await client`select count(*)::int as favs from favorite where user_id = ${ana.id}`
    expect(favs).toBe(0)
  })

  it('o repertório da Bia continua com a música, agora como cópia dela', async () => {
    const items = (await call(bia, 'GET', `/setlists/${biaSetlist}`)).data.items
    expect(items).toHaveLength(1)
    expect(items[0].song.title).toBe(`Cifra da Ana ${run}`)
    expect(items[0].key).toBe('D')
    expect((await call(bia, 'GET', `/songs/${items[0].song.id}`)).data.ownerId).toBe(bia.id)
  })
})
