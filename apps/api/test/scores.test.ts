// Partituras: envio das páginas já convertidas, leitura com permissão e limpeza.
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

// Uma "página" WebP mínima: o servidor só confere o cabeçalho RIFF....WEBP.
const fakeWebp = (fill: number) => {
  const b = new Uint8Array(64).fill(fill)
  b.set([0x52, 0x49, 0x46, 0x46], 0) // RIFF
  b.set([0x57, 0x45, 0x42, 0x50], 8) // WEBP
  return b
}

async function upload(u: User, fields: { songId: string; label: string; instrument?: string; pages: Uint8Array[]; mime?: string }) {
  const fd = new FormData()
  fd.set('songId', fields.songId)
  fd.set('label', fields.label)
  if (fields.instrument) fd.set('instrument', fields.instrument)
  fd.set('sizes', JSON.stringify(fields.pages.map(() => [1600, 2263])))
  fields.pages.forEach((p, i) => fd.set(`page${i}`, new Blob([p], { type: fields.mime ?? 'image/webp' }), `${i}.webp`))
  const res = await app.request('/api/scores', { method: 'POST', headers: { origin: ORIGIN, cookie: u.cookie }, body: fd })
  const text = await res.text()
  return { status: res.status, data: text ? JSON.parse(text) : null }
}

const page = (u: User, id: string, n: number) =>
  app.request(`/api/scores/${id}/${n}.webp`, { headers: { origin: ORIGIN, cookie: u.cookie } })

let dono: User, musico: User, estranho: User
let songId: string, scoreId: string

beforeAll(async () => {
  ;[dono, musico, estranho] = await Promise.all(['dono', 'musico', 'estranho'].map(signUp))
  songId = (await call(dono, 'POST', '/songs', { title: `Partitura ${run}`, content: '[Intro] C G' })).data.id
  const setlistId = (await call(dono, 'POST', '/setlists', { name: `Orquestra ${run}` })).data.id
  await call(dono, 'POST', `/setlists/${setlistId}/items`, { songId })
  const inv = await call(dono, 'POST', `/setlists/${setlistId}/invites`, { permission: 'view' })
  await call(musico, 'POST', `/invites/${inv.data.code}/accept`)
})

afterAll(async () => {
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('partituras', () => {
  it('a dona envia as páginas e elas aparecem na música', async () => {
    const r = await upload(dono, { songId, label: 'Sax alto em Mi♭', instrument: 'sopro', pages: [fakeWebp(1), fakeWebp(2)] })
    expect(r.status).toBe(201)
    expect(r.data).toMatchObject({ pages: 2, totalBytes: 128 })
    scoreId = r.data.id
    const song = (await call(dono, 'GET', `/songs/${songId}`)).data
    expect(song.scores).toEqual([
      { id: scoreId, label: 'Sax alto em Mi♭', instrument: 'sopro', totalBytes: 128, pages: [{ w: 1600, h: 2263, bytes: 64 }, { w: 1600, h: 2263, bytes: 64 }] },
    ])
  })

  it('a página volta igual, como imagem; a banda do repertório também vê', async () => {
    const r = await page(dono, scoreId, 1)
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('image/webp')
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(fakeWebp(2))
    expect((await page(musico, scoreId, 0)).status).toBe(200)
  })

  it('quem não participa não vê; página que não existe dá 404', async () => {
    expect((await page(estranho, scoreId, 0)).status).toBe(404)
    expect((await page(dono, scoreId, 5)).status).toBe(404)
  })

  it('só a dona da música envia, e só WebP', async () => {
    expect((await upload(musico, { songId, label: 'Trompete', pages: [fakeWebp(3)] })).status).toBe(403)
    const notWebp = await upload(dono, { songId, label: 'PDF cru', pages: [new TextEncoder().encode('%PDF-1.7 conteúdo qualquer')] })
    expect(notWebp.status).toBe(400)
  })

  it('renomear e apagar', async () => {
    expect((await call(dono, 'PATCH', `/scores/${scoreId}`, { label: 'Sax alto', instrument: 'sopro' })).status).toBe(200)
    expect((await call(musico, 'DELETE', `/scores/${scoreId}`)).status).toBe(403)
    expect((await call(dono, 'DELETE', `/scores/${scoreId}`)).status).toBe(204)
    expect((await page(dono, scoreId, 0)).status).toBe(404)
    expect((await call(dono, 'GET', `/songs/${songId}`)).data.scores).toEqual([])
  })
})
