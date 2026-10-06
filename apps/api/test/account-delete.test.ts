// Excluir a conta (LGPD): some tudo da pessoa, mas o repertório dos outros não quebra.
// Rodam contra o banco de desenvolvimento e apagam tudo o que criam no fim.
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const { app } = await import('../src/app')
const { client } = await import('../src/db')

const ORIGIN = process.env.APP_URL!
const DOMAIN = 'teste.ensaiofacil.app'
const run = randomBytes(4).toString('hex')

type User = { name: string; cookie: string; id: string; password: string }

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
  const email = `${name}-${run}@${DOMAIN}`
  const password = `senha-${run}-${name}`
  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  })
  expect(res.status).toBe(200)
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
  const { user } = await res.json()
  return { name, cookie, id: user.id, password }
}

const deleteAccount = (u: User, password: string) => call(u, 'POST', '/auth/delete-user', { password })

let autora: User, bia: User, caio: User
let songId: string, biaSetlists: string[], caioSetlist: string, ownSetlist: string

beforeAll(async () => {
  ;[autora, bia, caio] = await Promise.all(['autora', 'bia', 'caio'].map(signUp))
  songId = (
    await call(autora, 'POST', '/songs', {
      title: `Cifra da autora ${run}`,
      visibility: 'public',
      license: 'own',
      lyricsAuthorized: true,
      content: '[Intro] C G\nC        G\nletra da música',
    })
  ).data.id
  const newSetlist = async (u: User, name: string) => (await call(u, 'POST', '/setlists', { name: `${name} ${run}` })).data.id as string
  ownSetlist = await newSetlist(autora, 'Meu show')
  biaSetlists = [await newSetlist(bia, 'Culto'), await newSetlist(bia, 'Ensaio')]
  caioSetlist = await newSetlist(caio, 'Baile')
  for (const [u, s] of [
    [autora, ownSetlist],
    [bia, biaSetlists[0]],
    [bia, biaSetlists[1]],
    [caio, caioSetlist],
  ] as const) {
    expect((await call(u, 'POST', `/setlists/${s}/items`, { songId, key: 'D' })).status).toBe(201)
  }
})

afterAll(async () => {
  await client`delete from setlist where owner_id in (select id from "user" where email like ${'%-' + run + '@' + DOMAIN})`
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('excluir a conta', () => {
  it('senha errada: não exclui nada', async () => {
    const r = await deleteAccount(autora, 'senha-errada-123')
    expect(r.status).toBeGreaterThanOrEqual(400)
    expect((await call(autora, 'GET', `/songs/${songId}`)).status).toBe(200)
  })

  it('exclui a pessoa e os dados dela', async () => {
    const r = await deleteAccount(autora, autora.password)
    expect(r.status).toBe(200)
    const [{ n }] = await client`select count(*)::int as n from "user" where id = ${autora.id}`
    expect(n).toBe(0)
    const [{ songs }] = await client`select count(*)::int as songs from song where owner_id = ${autora.id}`
    expect(songs).toBe(0)
    const [{ sets }] = await client`select count(*)::int as sets from setlist where id = ${ownSetlist}`
    expect(sets).toBe(0)
    // A sessão antiga não vale mais.
    expect((await call(autora, 'GET', '/me')).status).toBe(401)
  })

  it('o repertório dos outros continua com a música, agora como cópia de cada dono', async () => {
    const biaItems = await Promise.all(biaSetlists.map(async (s) => (await call(bia, 'GET', `/setlists/${s}`)).data.items))
    const caioItems = (await call(caio, 'GET', `/setlists/${caioSetlist}`)).data.items
    for (const items of [...biaItems, caioItems]) {
      expect(items).toHaveLength(1)
      expect(items[0].song.title).toBe(`Cifra da autora ${run}`)
      expect(items[0].key).toBe('D')
    }
    // Uma cópia para a Bia (usada nos dois repertórios dela) e outra para o Caio.
    const biaCopy = biaItems[0][0].song.id
    expect(biaItems[1][0].song.id).toBe(biaCopy)
    expect(caioItems[0].song.id).not.toBe(biaCopy)
    const copy = (await call(bia, 'GET', `/songs/${biaCopy}`)).data
    expect(copy.ownerId).toBe(bia.id)
    expect(copy.visibility).toBe('private')
    expect(copy.content).toContain('letra da música')
  })
})
