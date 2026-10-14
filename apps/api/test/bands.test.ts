// Página pública da banda e pedidos de orçamento. Banco de desenvolvimento; e-mail não sai.
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const { app } = await import('../src/app')
const { client } = await import('../src/db')

const ORIGIN = process.env.APP_URL!
const DOMAIN = 'teste.ensaiofacil.app'
const run = randomBytes(4).toString('hex')
const slug = `banda-${run}`

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
async function call(u: User | null, method: string, path: string, body?: unknown, ip = '10.0.0.1') {
  const res = await app.request(`/api${path}`, {
    method,
    headers: {
      origin: ORIGIN,
      'x-forwarded-for': ip,
      ...(u ? { cookie: u.cookie } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, data: text ? JSON.parse(text) : null }
}

let dono: User, outro: User
let pageId: string

beforeAll(async () => {
  ;[dono, outro] = await Promise.all(['dono', 'outro'].map(signUp))
  const setlistId = (await call(dono, 'POST', '/setlists', { name: `Show ${run}` })).data.id
  const s = (await call(dono, 'POST', '/songs', { title: `Evidências ${run}`, artist: 'Chitãozinho', content: 'C G\nLetra secreta' })).data.id
  await call(dono, 'POST', `/setlists/${setlistId}/items`, { songId: s })
  const r = await call(dono, 'POST', '/bandas', { slug, name: 'Banda Sol Maior', city: 'Fortaleza', setlistId })
  pageId = r.data.id
})

afterAll(async () => {
  await client`delete from band_page where owner_id in (select id from "user" where email like ${'%-' + run + '@' + DOMAIN})`
  await client`delete from setlist where owner_id in (select id from "user" where email like ${'%-' + run + '@' + DOMAIN})`
  await client`delete from song where owner_id in (select id from "user" where email like ${'%-' + run + '@' + DOMAIN})`
  await client`delete from "user" where email like ${'%-' + run + '@' + DOMAIN}`
  await client.end()
})

describe('página da banda', () => {
  it('é aberta, mostra o repertório só com nome e artista', async () => {
    const r = await call(null, 'GET', `/publico/bandas/${slug}`)
    expect(r.status).toBe(200)
    expect(r.data).toMatchObject({ name: 'Banda Sol Maior', city: 'Fortaleza', songs: [{ title: `Evidências ${run}`, artist: 'Chitãozinho' }] })
    expect(JSON.stringify(r.data)).not.toContain('Letra secreta')
    expect(r.data.setlistId).toBeUndefined()
  })

  it('endereço é único e validado; outra pessoa não edita', async () => {
    expect((await call(outro, 'POST', '/bandas', { slug, name: 'Outra' })).status).toBe(409)
    expect((await call(outro, 'POST', '/bandas', { slug: 'admin', name: 'Outra' })).status).toBe(400)
    expect((await call(outro, 'POST', '/bandas', { slug: 'Nome Com Espaço', name: 'Outra' })).status).toBe(400)
    expect((await call(outro, 'PUT', `/bandas/${pageId}`, { slug, name: 'Invadida' })).status).toBe(404)
    expect((await call(outro, 'GET', `/bandas/${pageId}/pedidos`)).status).toBe(404)
  })

  it('pedido de orçamento chega para o dono; robô é ignorado; limite por IP', async () => {
    const ok = await call(null, 'POST', `/publico/bandas/${slug}/orcamento`, {
      name: 'Maria',
      contact: '(85) 99999-0000',
      eventDate: '2027-01-20',
      eventType: 'Casamento',
    }, `10.1.${run.length}.1`)
    expect(ok.status).toBe(201)
    await call(null, 'POST', `/publico/bandas/${slug}/orcamento`, { name: 'Robô', contact: 'spam@spam.com', website: 'http://spam' }, '10.9.9.9')
    const list = await call(dono, 'GET', `/bandas/${pageId}/pedidos`)
    expect(list.data).toMatchObject([{ name: 'Maria', eventType: 'Casamento', status: 'novo' }])
    expect((await call(dono, 'PATCH', `/bandas/pedidos/${list.data[0].id}`, { status: 'respondido' })).status).toBe(200)
    expect((await call(outro, 'PATCH', `/bandas/pedidos/${list.data[0].id}`, { status: 'arquivado' })).status).toBe(404)

    const ip = `10.2.${Math.floor(Math.random() * 200)}.7`
    const codes = []
    for (let i = 0; i < 6; i++)
      codes.push((await call(null, 'POST', `/publico/bandas/${slug}/orcamento`, { name: 'Zé', contact: '85999990000' }, ip)).status)
    expect(codes.at(-1)).toBe(429)
  })

  it('despublicada some', async () => {
    await call(dono, 'PUT', `/bandas/${pageId}`, { slug, name: 'Banda Sol Maior', published: false })
    expect((await call(null, 'GET', `/publico/bandas/${slug}`)).status).toBe(404)
  })
})
