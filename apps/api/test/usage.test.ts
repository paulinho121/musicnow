// Prova social: quantas vezes a música entrou em repertórios de outras pessoas.
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

let autora: User, bia: User, caio: User
let songId: string, otherId: string

const usage = async () => {
  const s = (await call(autora, 'GET', `/songs/${songId}`)).data
  return [s.usageSetlists, s.usagePeople]
}
const newSetlist = async (u: User, name: string) => (await call(u, 'POST', '/setlists', { name: `${name} ${run}` })).data.id as string

beforeAll(async () => {
  ;[autora, bia, caio] = await Promise.all(['autora', 'bia', 'caio'].map(signUp))
  const pub = { visibility: 'public', license: 'own', lyricsAuthorized: true, content: '[Intro] C G' }
  songId = (await call(autora, 'POST', '/songs', { title: `Cifra boa ${run}`, ...pub })).data.id
  otherId = (await call(autora, 'POST', '/songs', { title: `Outra ${run}`, ...pub })).data.id
})

afterAll(async () => {
  // Repertórios primeiro: a música da autora está no repertório de outras pessoas.
  await client`delete from setlist where owner_id in (select id from "user" where email like ${'%-' + run + '@' + DOMAIN})`
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('uso em repertórios', () => {
  it('a autora usando a própria música não conta', async () => {
    const s = await newSetlist(autora, 'Meu show')
    await call(autora, 'POST', `/setlists/${s}/items`, { songId })
    expect(await usage()).toEqual([0, 0])
  })

  it('outra pessoa adiciona: conta repertório e pessoa', async () => {
    const s1 = await newSetlist(bia, 'Culto')
    expect((await call(bia, 'POST', `/setlists/${s1}/items`, { songId })).status).toBe(201)
    expect(await usage()).toEqual([1, 1])

    // Segundo repertório da mesma pessoa: +1 repertório, mesma pessoa.
    const s2 = await newSetlist(bia, 'Ensaio')
    await call(bia, 'POST', `/setlists/${s2}/items`, { songId })
    expect(await usage()).toEqual([2, 1])

    // Tirar e pôr de novo no mesmo repertório não conta duas vezes.
    const item = (await call(bia, 'GET', `/setlists/${s2}`)).data.items[0].id
    await call(bia, 'DELETE', `/setlists/${s2}/items/${item}`)
    await call(bia, 'POST', `/setlists/${s2}/items`, { songId })
    expect(await usage()).toEqual([2, 1])
  })

  it('colar a lista e duplicar o repertório também contam', async () => {
    const s3 = await newSetlist(caio, 'Baile')
    const r = await call(caio, 'POST', `/setlists/${s3}/import-text`, { text: `BLOCO 1 (Pop - 120)\nCifra boa ${run} - G` })
    expect(r.data.found).toBe(1)
    expect(await usage()).toEqual([3, 2])

    const copy = await call(caio, 'POST', `/setlists/${s3}/duplicate`, {})
    expect(copy.status).toBe(201)
    expect(await usage()).toEqual([4, 2])
  })

  it('apagar o repertório não apaga o histórico', async () => {
    const s = (await call(caio, 'GET', '/setlists')).data.find((x: { name: string }) => x.name.startsWith(`Baile ${run}`))
    expect((await call(caio, 'DELETE', `/setlists/${s.id}`)).status).toBe(204)
    expect(await usage()).toEqual([4, 2])
  })

  it('nas músicas públicas, as mais usadas vêm primeiro (e o número aparece na lista)', async () => {
    const list = (await call(caio, 'GET', `/songs?scope=public&q=${run}`)).data as { id: string; usagePeople: number }[]
    expect(list.map((s) => s.id).slice(0, 2)).toEqual([songId, otherId])
    expect(list[0].usagePeople).toBe(2)
  })
})
