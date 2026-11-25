// Excluir vários repertórios e músicas de uma vez (seleção nas listas).
// Rodam contra o banco de desenvolvimento e apagam tudo o que criam no fim.
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const { app } = await import('../src/app')
const { client } = await import('../src/db')

const ORIGIN = process.env.APP_URL!
const DOMAIN = 'teste.ensaiofacil.app'
const run = randomBytes(4).toString('hex')

type User = { cookie: string; id: string }

async function call(u: User, method: string, path: string, body?: unknown) {
  const res = await app.request(`/api${path}`, {
    method,
    headers: { origin: ORIGIN, cookie: u.cookie, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
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
  return { cookie, id: (await res.json()).user.id }
}

const newSong = async (u: User, title: string) =>
  (await call(u, 'POST', '/songs', { title: `${title} ${run}`, content: 'C  G\nletra', visibility: 'private' })).data.id as string
const newSetlist = async (u: User, name: string, songs: string[]) => {
  const id = (await call(u, 'POST', '/setlists', { name: `${name} ${run}` })).data.id as string
  for (const songId of songs) expect((await call(u, 'POST', `/setlists/${id}/items`, { songId })).status).toBe(201)
  return id
}
const exists = async (table: 'song' | 'setlist', id: string) =>
  (await client`select count(*)::int as n from ${client(table)} where id = ${id}`)[0].n === 1

let ana: User, bia: User

beforeAll(async () => {
  ;[ana, bia] = await Promise.all(['ana', 'bia'].map(signUp))
})

afterAll(async () => {
  await client`delete from setlist where owner_id in (select id from "user" where email like ${'%-' + run + '@' + DOMAIN})`
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('excluir vários', () => {
  it('músicas: apaga as suas, guarda as que estão em repertório e ignora as dos outros', async () => {
    const [livre1, livre2, emUso] = [await newSong(ana, 'Livre 1'), await newSong(ana, 'Livre 2'), await newSong(ana, 'Em uso')]
    const daBia = await newSong(bia, 'Da Bia')
    await newSetlist(ana, 'Show', [emUso])
    const r = await call(ana, 'POST', '/songs/bulk-delete', { ids: [livre1, livre2, emUso, daBia] })
    expect(r.status).toBe(200)
    expect(r.data.deleted).toBe(2)
    expect(r.data.kept.map((k: { id: string }) => k.id)).toEqual([emUso])
    expect(await exists('song', livre1)).toBe(false)
    expect(await exists('song', emUso)).toBe(true)
    expect(await exists('song', daBia)).toBe(true)
  })

  it('repertórios: apaga só os seus e, se pedir, as músicas que ficaram sem repertório', async () => {
    const [s1, s2, compartilhada] = [await newSong(ana, 'S1'), await newSong(ana, 'S2'), await newSong(ana, 'Compartilhada')]
    const r1 = await newSetlist(ana, 'Culto', [s1, compartilhada])
    const r2 = await newSetlist(ana, 'Baile', [s2])
    const fica = await newSetlist(ana, 'Fica', [compartilhada])
    const daBia = await newSetlist(bia, 'Da Bia', [])
    const r = await call(ana, 'POST', '/setlists/bulk-delete', { ids: [r1, r2, daBia], withSongs: true })
    expect(r.status).toBe(200)
    expect(r.data.setlists).toBe(2)
    expect(r.data.songs).toBe(2)
    expect(r.data.kept.map((k: { id: string }) => k.id)).toEqual([compartilhada])
    expect(await exists('setlist', r1)).toBe(false)
    expect(await exists('setlist', fica)).toBe(true)
    expect(await exists('setlist', daBia)).toBe(true)
    expect(await exists('song', s1)).toBe(false)
    expect(await exists('song', compartilhada)).toBe(true)
  })

  it('repertórios sem as músicas: as músicas continuam na biblioteca', async () => {
    const s = await newSong(ana, 'Continua')
    const r1 = await newSetlist(ana, 'Ensaio', [s])
    const r = await call(ana, 'POST', '/setlists/bulk-delete', { ids: [r1] })
    expect(r.data).toMatchObject({ setlists: 1, songs: 0 })
    expect(await exists('song', s)).toBe(true)
  })
})
