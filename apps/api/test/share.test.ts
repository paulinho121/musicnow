// Compartilhar uma música por link: quem recebe vê e toca, só a dona edita.
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

let dona: User, amigo: User, outro: User
let songId: string, code: string

const codeOf = (url: string) => url.split('/').pop()!

beforeAll(async () => {
  ;[dona, amigo, outro] = await Promise.all(['dona', 'amigo', 'outro'].map(signUp))
  songId = (await call(dona, 'POST', '/songs', { title: `Compartilhada ${run}`, content: '[Intro] Am C', lyricsAuthorized: true })).data.id
})

afterAll(async () => {
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('compartilhar música por link', () => {
  it('sem link, a música é só da dona', async () => {
    expect((await call(dona, 'GET', `/songs/${songId}/share`)).data).toEqual({ url: null, people: [] })
    expect((await call(amigo, 'GET', `/songs/${songId}`)).status).toBe(404)
  })

  it('a dona gera o link; só ela vê e mexe nele', async () => {
    const r = await call(dona, 'POST', `/songs/${songId}/share`, {})
    expect(r.status).toBe(200)
    expect(r.data.url).toMatch(/\/compartilhado\/[A-Z2-9]{10}$/)
    code = codeOf(r.data.url)
    // Pedir de novo devolve o mesmo link.
    expect((await call(dona, 'POST', `/songs/${songId}/share`, {})).data.url).toBe(r.data.url)
    expect((await call(amigo, 'POST', `/songs/${songId}/share`, {})).status).toBe(403)
  })

  it('o amigo abre o link, adiciona e passa a ver e tocar (mas não edita)', async () => {
    const preview = await call(amigo, 'GET', `/shared/${code}`)
    expect(preview.data).toMatchObject({ id: songId, title: `Compartilhada ${run}`, ownerName: 'dona', alreadyHas: false, isOwner: false })
    expect((await call(amigo, 'POST', `/shared/${code}/accept`)).status).toBe(201)
    expect((await call(amigo, 'POST', `/shared/${code}/accept`)).status).toBe(201) // de novo: sem duplicar

    const song = await call(amigo, 'GET', `/songs/${songId}`)
    expect(song.status).toBe(200)
    expect(song.data).toMatchObject({ canEdit: false, ownerName: 'dona' })
    expect(song.data.shareCode).toBeUndefined() // o código do link não vaza para quem recebeu
    expect(song.data.content).toContain('Am C')

    const shared = await call(amigo, 'GET', '/songs?scope=shared')
    expect(shared.data.map((s: { id: string }) => s.id)).toEqual([songId])
    expect((await call(amigo, 'POST', `/songs/${songId}/marks`, { lineIndex: 0, type: 'nota', text: 'capo 2' })).status).toBe(201)
    expect((await call(amigo, 'PUT', `/songs/${songId}`, { title: 'Hackeada' })).status).toBe(403)

    const people = (await call(dona, 'GET', `/songs/${songId}/share`)).data.people
    expect(people.map((p: { userId: string; name: string }) => [p.userId, p.name])).toEqual([[amigo.id, 'amigo']])
  })

  it('quem não recebeu continua sem ver; link inválido dá 404', async () => {
    expect((await call(outro, 'GET', `/songs/${songId}`)).status).toBe(404)
    expect((await call(outro, 'GET', '/shared/AAAAAAAAAA')).status).toBe(404)
  })

  it('trocar o link mata o antigo (quem já tem continua com a música)', async () => {
    const novo = codeOf((await call(dona, 'POST', `/songs/${songId}/share`, { rotate: true })).data.url)
    expect(novo).not.toBe(code)
    expect((await call(outro, 'GET', `/shared/${code}`)).status).toBe(404)
    expect((await call(amigo, 'GET', `/songs/${songId}`)).status).toBe(200)
    code = novo
  })

  it('a dona remove o acesso; o amigo também pode sair sozinho', async () => {
    expect((await call(outro, 'POST', `/shared/${code}/accept`)).status).toBe(201)
    expect((await call(amigo, 'DELETE', `/songs/${songId}/share/${outro.id}`)).status).toBe(403)
    expect((await call(dona, 'DELETE', `/songs/${songId}/share/${outro.id}`)).status).toBe(204)
    expect((await call(outro, 'GET', `/songs/${songId}`)).status).toBe(404)

    expect((await call(amigo, 'DELETE', `/songs/${songId}/share/eu`)).status).toBe(204)
    expect((await call(amigo, 'GET', `/songs/${songId}`)).status).toBe(404)
  })

  it('desligar o link', async () => {
    expect((await call(dona, 'DELETE', `/songs/${songId}/share`)).status).toBe(204)
    expect((await call(dona, 'GET', `/songs/${songId}/share`)).data.url).toBeNull()
    expect((await call(outro, 'GET', `/shared/${code}`)).status).toBe(404)
  })
})
