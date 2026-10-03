// Conta nova: começa com a música de exemplo (passo a passo) e nada mais dela.
// Roda contra o banco de desenvolvimento e apaga a conta no fim.
import { randomBytes } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'

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
  const email = `${name}-${run}@${DOMAIN}`
  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ name, email, password: `senha-${run}-${name}` }),
  })
  expect(res.status).toBe(200)
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
  const { user } = await res.json()
  return { name, cookie, id: user.id }
}

afterAll(async () => {
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('conta nova', () => {
  it('começa com uma música: o passo a passo, privada e editável pela pessoa', async () => {
    const u = await signUp('novato')
    const mine = await call(u, 'GET', '/songs?scope=mine')
    expect(mine.data).toHaveLength(1)
    const song = await call(u, 'GET', `/songs/${mine.data[0].id}`)
    expect(song.data.title).toMatch(/^Comece aqui/)
    expect(song.data.visibility).toBe('private')
    expect(song.data.canEdit).toBe(true)
    expect(song.data.lyricsHidden).toBe(false)
  })
})

describe('capa da música', () => {
  it('só aceita link do Cover Art Archive, ou "" para a capa gerada', async () => {
    const u = await signUp('capa')
    const bad = await call(u, 'POST', '/songs', { title: 'Teste capa', coverUrl: 'https://exemplo.com/capa.jpg' })
    expect(bad.status).toBe(400)
    const ok = await call(u, 'POST', '/songs', {
      title: 'Teste capa',
      coverUrl: 'https://coverartarchive.org/release-group/b3d1fbf7-dd1c-4119-a16e-58c2feb5bcb0/front-250',
    })
    expect(ok.status).toBe(201)
    const generated = await call(u, 'POST', '/songs', { title: 'Teste capa gerada', coverUrl: '' })
    expect(generated.status).toBe(201)
    const list = await call(u, 'GET', '/songs?scope=mine')
    const byTitle = Object.fromEntries(list.data.map((s: { title: string; coverUrl: string | null }) => [s.title, s.coverUrl]))
    expect(byTitle['Teste capa']).toMatch(/^https:\/\/coverartarchive\.org\//)
    expect(byTitle['Teste capa gerada']).toBe('')
  })
})
