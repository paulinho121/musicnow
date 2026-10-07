// Links do Spotify/Deezer/Apple Music e repertório montado de uma playlist. Banco de
// desenvolvimento; a API do Deezer é simulada (sem rede nos testes).
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const { app } = await import('../src/app')
const { client } = await import('../src/db')

const ORIGIN = process.env.APP_URL!
const DOMAIN = 'teste.ensaiofacil.app'
const run = randomBytes(4).toString('hex')

type User = { cookie: string; id: string }
async function signUp(name: string): Promise<User> {
  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ name, email: `${name}-${run}@${DOMAIN}`, password: `senha-${run}-${name}` }),
  })
  return {
    cookie: res.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; '),
    id: (await res.json()).user.id,
  }
}
async function call(u: User, method: string, path: string, body?: unknown) {
  const res = await app.request(`/api${path}`, {
    method,
    headers: { origin: ORIGIN, cookie: u.cookie, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, data: text ? JSON.parse(text) : null }
}

// Deezer simulado: playlist 123 com 3 músicas (uma em versão ao vivo).
const realFetch = globalThis.fetch
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
  const url = String(input instanceof Request ? input.url : input)
  if (url === 'https://api.deezer.com/playlist/123') return json({ title: `Missa ${run}` })
  if (url.startsWith('https://api.deezer.com/playlist/123/tracks')) {
    return json({
      data: [
        {
          title: 'Eis-me Aqui Senhor (Ao Vivo)',
          title_short: 'Eis-me Aqui Senhor',
          link: 'https://www.deezer.com/track/11',
          artist: { name: 'Padre Zezinho' },
        },
        { title: `Santo ${run}`, link: 'https://www.deezer.com/track/22', artist: { name: 'Ministério' } },
        { title: 'Cordeiro - Ao Vivo', link: 'https://www.deezer.com/track/33', artist: { name: 'Ministério' } },
      ],
    })
  }
  if (url === 'https://api.deezer.com/playlist/404') return json({ error: { type: 'DataException', message: 'no data', code: 800 } })
  return realFetch(input, init)
})

let ana: User, beto: User

beforeAll(async () => {
  ;[ana, beto] = await Promise.all(['ana', 'beto'].map(signUp))
})

afterAll(async () => {
  vi.restoreAllMocks()
  await client`delete from setlist where owner_id in (select id from "user" where email like ${'%-' + run + '@' + DOMAIN})`
  await client`delete from song where owner_id in (select id from "user" where email like ${'%-' + run + '@' + DOMAIN})`
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('gravação de referência', () => {
  it('aceita Spotify, Deezer e Apple Music e guarda o link limpo', async () => {
    const r = await call(ana, 'POST', '/songs', {
      title: `Aquarela ${run}`,
      referenceUrl: 'https://open.spotify.com/intl-pt/track/4uLU6hMCjMI75M1A2tKUQC?si=rastreio',
    })
    expect(r.status).toBe(201)
    const song = await call(ana, 'GET', `/songs/${r.data.id}`)
    expect(song.data.referenceUrl).toBe('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC')

    const bad = await call(ana, 'POST', '/songs', { title: 'X', referenceUrl: 'https://example.com/track/1' })
    expect(bad.status).toBe(400)
  })

  it('troca só o link, e só quem cadastrou a música', async () => {
    const { data } = await call(ana, 'POST', '/songs', { title: `Trocar ${run}` })
    const ok = await call(ana, 'PUT', `/songs/${data.id}/reference`, { referenceUrl: 'https://www.deezer.com/br/track/3135556' })
    expect(ok).toEqual({ status: 200, data: { referenceUrl: 'https://www.deezer.com/track/3135556' } })
    expect((await call(beto, 'PUT', `/songs/${data.id}/reference`, { referenceUrl: null })).status).toBe(403)
    const cleared = await call(ana, 'PUT', `/songs/${data.id}/reference`, { referenceUrl: null })
    expect(cleared.data.referenceUrl).toBeNull()
  })
})

describe('repertório de uma playlist', () => {
  it('lê a playlist do Deezer e marca o que já está na biblioteca', async () => {
    await call(ana, 'POST', '/songs', { title: `Santo ${run}`, artist: 'Ministério' })
    const r = await call(ana, 'POST', '/songs/playlist', { url: 'https://www.deezer.com/br/playlist/123?utm=x' })
    expect(r.status).toBe(200)
    expect(r.data.name).toBe(`Missa ${run}`)
    expect(r.data.tracks.map((t: { title: string }) => t.title)).toEqual(['Eis-me Aqui Senhor', `Santo ${run}`, 'Cordeiro'])
    expect(r.data.tracks.map((t: { songId: string | null }) => Boolean(t.songId))).toEqual([false, true, false])
  })

  it('playlist inexistente ou link de outro site: mensagem clara', async () => {
    const missing = await call(ana, 'POST', '/songs/playlist', { url: 'https://www.deezer.com/playlist/404' })
    expect(missing.status).toBe(400)
    expect(missing.data.error).toMatch(/pública/)
    const other = await call(ana, 'POST', '/songs/playlist', { url: 'https://example.com/playlist/1' })
    expect(other.status).toBe(400)
  })

  it('adiciona várias músicas de uma vez, na ordem', async () => {
    const ids: string[] = []
    for (const title of ['Um', 'Dois', 'Três']) ids.push((await call(ana, 'POST', '/songs', { title: `${title} ${run}` })).data.id)
    const setlist = (await call(ana, 'POST', '/setlists', { name: `Playlist ${run}` })).data.id
    const r = await call(ana, 'POST', `/setlists/${setlist}/items/batch`, { songIds: ids, source: 'playlist do Deezer' })
    expect(r).toEqual({ status: 201, data: { added: 3 } })
    const detail = await call(ana, 'GET', `/setlists/${setlist}`)
    expect(detail.data.items.map((i: { song: { id: string } }) => i.song.id)).toEqual(ids)
    expect(detail.data.items[0].song.ownerId).toBe(ana.id)
    // Quem não é da banda não adiciona (nem fica sabendo que o repertório existe).
    expect((await call(beto, 'POST', `/setlists/${setlist}/items/batch`, { songIds: ids })).status).toBe(404)
  })
})
