// Painel de admin: quem é admin, bloquear de verdade (login e sessões) e proteções.
// Rodam contra o banco de desenvolvimento e apagam tudo o que criam no fim.
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const DOMAIN = 'teste.ensaiofacil.app'
const run = randomBytes(4).toString('hex')
// O admin deste teste vem da lista de e-mails (como na produção).
process.env.ADMIN_EMAILS = `chefe-${run}@${DOMAIN}`

const { app } = await import('../src/app')
const { client } = await import('../src/db')
const ORIGIN = process.env.APP_URL!

type User = { name: string; cookie: string; id: string; email: string; password: string }

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

const cookieOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')

async function signUp(name: string): Promise<User> {
  const email = `${name}-${run}@${DOMAIN}`
  const password = `senha-${run}-${name}`
  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  })
  expect(res.status).toBe(200)
  const { user } = await res.json()
  return { name, cookie: cookieOf(res), id: user.id, email, password }
}

const signIn = (u: User) =>
  app.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ email: u.email, password: u.password }),
  })

let chefe: User, musico: User

beforeAll(async () => {
  ;[chefe, musico] = await Promise.all(['chefe', 'musico'].map(signUp))
})

afterAll(async () => {
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('acesso ao painel', () => {
  it('só admin entra; o músico não', async () => {
    expect((await call(chefe, 'GET', '/admin/overview')).status).toBe(200)
    expect((await call(musico, 'GET', '/admin/overview')).status).toBe(403)
  })

  it('ninguém se promove a admin pela própria conta', async () => {
    const res = await app.request('/api/auth/update-user', {
      method: 'POST',
      headers: { origin: ORIGIN, cookie: musico.cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'admin', banned: false }),
    })
    expect(res.status).not.toBe(200)
    expect((await call(musico, 'GET', '/admin/overview')).status).toBe(403)
  })

  it('"Tornar admin" pelo painel funciona (e dá para tirar)', async () => {
    expect((await call(chefe, 'PATCH', `/admin/users/${musico.id}/role`, { role: 'admin' })).status).toBe(200)
    expect((await call(musico, 'GET', '/admin/overview')).status).toBe(200)
    expect((await call(chefe, 'PATCH', `/admin/users/${musico.id}/role`, { role: 'user' })).status).toBe(200)
    expect((await call(musico, 'GET', '/admin/overview')).status).toBe(403)
  })

  it('funil: conta o músico novo e só o admin vê', async () => {
    const r = await call(chefe, 'GET', '/admin/funnel?days=1')
    expect(r.status).toBe(200)
    expect(r.data.signups).toBeGreaterThanOrEqual(1)
    for (const k of ['profile', 'opened', 'setlist', 'band', 'paid', 'viaPartner']) expect(typeof r.data[k]).toBe('number')
    expect(r.data.paid).toBeLessThanOrEqual(r.data.signups)
    expect((await call(musico, 'GET', '/admin/funnel')).status).toBe(403)
  })

  it('o admin não se tranca fora', async () => {
    expect((await call(chefe, 'PATCH', `/admin/users/${chefe.id}/status`, { banned: true })).status).toBe(400)
    expect((await call(chefe, 'PATCH', `/admin/users/${chefe.id}/role`, { role: 'user' })).status).toBe(400)
  })
})

describe('bloquear usuário', () => {
  it('bloqueado sai na hora e não consegue entrar de novo', async () => {
    expect((await call(musico, 'GET', '/me')).status).toBe(200)
    expect((await call(chefe, 'PATCH', `/admin/users/${musico.id}/status`, { banned: true })).status).toBe(200)

    const after = await call(musico, 'GET', '/me')
    expect(after.status).toBe(401)
    expect(after.data.error).toMatch(/bloqueada/)
    expect((await signIn(musico)).status).toBe(403)
  })

  it('desbloqueado volta a entrar', async () => {
    expect((await call(chefe, 'PATCH', `/admin/users/${musico.id}/status`, { banned: false })).status).toBe(200)
    const res = await signIn(musico)
    expect(res.status).toBe(200)
    expect((await call({ ...musico, cookie: cookieOf(res) }, 'GET', '/me')).status).toBe(200)
  })
})

describe('registro de visitas', () => {
  const visit = (ip: string, path: string) =>
    app.request('/api/analytics/visit', {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify({ path }),
    })

  it('não guarda o IP puro (LGPD) e segura excesso de um mesmo IP', async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 200) + 10}`
    const path = `/teste-${run}`
    for (let i = 0; i < 35; i++) expect((await visit(ip, path)).status).toBe(200)
    // A gravação é assíncrona: espera um instante.
    await new Promise((r) => setTimeout(r, 500))
    const rows = await client`select ip from page_visit where path = ${path}`
    expect(rows.length).toBe(30)
    expect(rows.every((r) => r.ip !== ip && /^[0-9a-f]{24}$/.test(r.ip))).toBe(true)
    await client`delete from page_visit where path = ${path}`
  })
})
