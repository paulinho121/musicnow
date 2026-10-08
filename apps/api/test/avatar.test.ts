// Foto de perfil: enviar, ver, trocar e remover. Banco de desenvolvimento.
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

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

/** Um "WebP" mínimo: o servidor só confere o cabeçalho (quem gera a imagem é o aparelho). */
const webp = (extra = 64) => {
  const b = new Uint8Array(12 + extra)
  b.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0)
  b.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8)
  return b
}
async function upload(u: User, bytes: Uint8Array) {
  const fd = new FormData()
  fd.set('image', new Blob([bytes], { type: 'image/webp' }), 'foto.webp')
  const res = await app.request('/api/me/avatar', { method: 'POST', headers: { origin: ORIGIN, cookie: u.cookie }, body: fd })
  return { status: res.status, data: await res.json() }
}
const me = async (u: User) => (await app.request('/api/me', { headers: { origin: ORIGIN, cookie: u.cookie } }).then((r) => r.json())).image

let ana: User

beforeAll(async () => {
  ana = await signUp('ana')
})

afterAll(async () => {
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('foto de perfil', () => {
  it('envia, aparece no perfil e pode ser vista pela banda', async () => {
    const r = await upload(ana, webp())
    expect(r.status).toBe(201)
    expect(r.data.image).toMatch(/^\/api\/avatars\/[A-Za-z0-9_-]+\.webp$/)
    expect(await me(ana)).toBe(r.data.image)
    // Pública (como foto de rede social): abre sem login.
    const file = await app.request(r.data.image)
    expect(file.status).toBe(200)
    expect(file.headers.get('content-type')).toBe('image/webp')
  })

  it('trocar apaga a foto antiga; remover tira do perfil', async () => {
    const first = (await upload(ana, webp())).data.image
    const second = (await upload(ana, webp(80))).data.image
    expect(second).not.toBe(first)
    expect((await app.request(first)).status).toBe(404)
    const del = await app.request('/api/me/avatar', { method: 'DELETE', headers: { origin: ORIGIN, cookie: ana.cookie } })
    expect(del.status).toBe(200)
    expect(await me(ana)).toBeNull()
    expect((await app.request(second)).status).toBe(404)
  })

  it('recusa o que não é foto, foto grande e quem não entrou', async () => {
    const fake = new TextEncoder().encode('<script>alert(1)</script>')
    expect((await upload(ana, fake)).status).toBe(400)
    expect((await upload(ana, webp(500 * 1024))).status).toBe(413)
    const fd = new FormData()
    fd.set('image', new Blob([webp()]), 'foto.webp')
    expect((await app.request('/api/me/avatar', { method: 'POST', headers: { origin: ORIGIN }, body: fd })).status).toBe(401)
    expect((await app.request('/api/avatars/..%2F..%2Fapi.env')).status).toBe(404)
  })
})
