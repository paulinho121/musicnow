// Imagens do destaque do início: só a própria pessoa envia e vê; até 5.
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

const fakeWebp = () => {
  const b = new Uint8Array(80).fill(7)
  b.set([0x52, 0x49, 0x46, 0x46], 0)
  b.set([0x57, 0x45, 0x42, 0x50], 8)
  return b
}
const upload = async (u: User, bytes = fakeWebp()) => {
  const fd = new FormData()
  fd.set('image', new Blob([bytes], { type: 'image/webp' }), 'capa.webp')
  fd.set('w', '1920')
  fd.set('h', '1080')
  const res = await app.request('/api/me/hero', { method: 'POST', headers: { origin: ORIGIN, cookie: u.cookie }, body: fd })
  return { status: res.status, data: await res.json() }
}
const getImg = (u: User, id: string) => app.request(`/api/me/hero/${id}.webp`, { headers: { origin: ORIGIN, cookie: u.cookie } })

let paulo: User, outro: User

beforeAll(async () => {
  ;[paulo, outro] = await Promise.all(['paulo', 'outro'].map(signUp))
})

afterAll(async () => {
  for (const u of [paulo, outro]) {
    const me = (await call(u, 'GET', '/me')).data
    for (const img of me.heroImages ?? []) await call(u, 'DELETE', `/me/hero/${img.id}`)
  }
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('imagens do início', () => {
  it('envia, aparece no perfil e só a própria pessoa vê', async () => {
    const r = await upload(paulo)
    expect(r.status).toBe(201)
    expect(r.data.heroImages).toHaveLength(1)
    const id = r.data.heroImages[0].id
    expect((await call(paulo, 'GET', '/me')).data.heroImages).toEqual([{ id, w: 1920, h: 1080 }])
    const own = await getImg(paulo, id)
    expect(own.status).toBe(200)
    expect(own.headers.get('content-type')).toBe('image/webp')
    expect((await getImg(outro, id)).status).toBe(404)
  })

  it('só WebP, e no máximo 5', async () => {
    expect((await upload(paulo, new TextEncoder().encode('não é imagem nenhuma, só texto'))).status).toBe(400)
    for (let i = 0; i < 4; i++) expect((await upload(paulo)).status).toBe(201)
    const sexta = await upload(paulo)
    expect(sexta.status).toBe(400)
    expect(sexta.data.error).toMatch(/até 5/)
  })

  it('apagar libera o lugar', async () => {
    const imgs = (await call(paulo, 'GET', '/me')).data.heroImages
    const r = await call(paulo, 'DELETE', `/me/hero/${imgs[0].id}`)
    expect(r.data.heroImages).toHaveLength(4)
    expect((await getImg(paulo, imgs[0].id)).status).toBe(404)
    expect((await call(outro, 'DELETE', `/me/hero/${imgs[1].id}`)).status).toBe(404)
  })
})
